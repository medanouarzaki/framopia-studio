"""The sidecar entry point.

Contract: one JSON object on stdin, one JSON object on stdout, nothing else on
stdout ever. Progress, warnings and tracebacks go to stderr, because the
caller parses stdout and a stray print would corrupt a result rather than
merely clutter a log.

    {"task": "remove_bg", "imagePath": "...", "outPath": "...",
     "alphaMatting": false, "ocr": true}
    {"task": "segment_person", "framePaths": ["..."], "outDir": "...",
     "threshold": 0.5}
    {"task": "compute_zones", "frames": [{"maskPath": "...", "timeS": 0.0}],
     "sampleFps": 2}

Exit status is 0 with `{"ok": true, ...}` on success and 1 with
`{"ok": false, "error": "..."}` on failure. A failure is still valid JSON: the
caller should never have to distinguish "crashed" from "wrote garbage".
"""

from __future__ import annotations

import json
import sys
import traceback


def _remove_bg(request: dict) -> dict:
    from .gate import evaluate
    from .metrics import compute_metrics
    from .remove_bg import MODEL_NAME, alpha_of, original_luminance, remove_background

    image_path = request["imagePath"]
    out_path = request["outPath"]
    alpha_matting = bool(request.get("alphaMatting", False))
    post_process = bool(request.get("postProcessMask", False))

    cutout = remove_background(
        image_path, alpha_matting=alpha_matting, post_process_mask=post_process
    )
    cutout.save(out_path, "PNG")

    # The halo metric compares the cutout against the source, so it needs the
    # source. Without it it cannot tell a rendered rim from retained
    # background and a rim-lit render scores like a bad matte.
    metrics = compute_metrics(alpha_of(cutout), original_luminance(image_path))
    gate = evaluate(metrics)

    payload: dict = {
        "ok": True,
        "task": "remove_bg",
        "imagePath": image_path,
        "cutoutPath": out_path,
        "model": MODEL_NAME,
        "alphaMatting": alpha_matting,
        "postProcessMask": post_process,
        "width": cutout.width,
        "height": cutout.height,
        "metrics": metrics.to_dict(),
        "gate": gate.to_dict(),
    }

    if request.get("ocr", False):
        payload["ocr"] = _ocr_payload(request, image_path)

    return payload


def _ocr_payload(request: dict, image_path: str) -> dict:
    """OCR plus, when the caller supplies context, a correctness verdict.

    Without `idea` there is nothing to check against, so the result is the
    raw detection and no verdict — reporting "unexpected" against an empty
    expectation would flag every word ever read.
    """
    from .ocr import detect_text

    result = detect_text(image_path)
    payload = result.to_dict()

    idea = request.get("idea")
    if isinstance(idea, str) and idea.strip():
        from .text_check import check_text

        vocabulary = [v for v in request.get("modeVocabulary", []) if isinstance(v, str)]
        verdict = check_text([d.text for d in result.detections], idea, vocabulary)
        payload["verdict"] = verdict.to_dict()

    return payload


def _detect_text(request: dict) -> dict:
    image_path = request["imagePath"]
    return {
        "ok": True,
        "task": "detect_text",
        "imagePath": image_path,
        "ocr": _ocr_payload(request, image_path),
    }


def _segment_person(request: dict) -> dict:
    from .segment_person import DEFAULT_THRESHOLD, MODEL_NAME, MODEL_PATH, segment_frames

    frame_paths = request["framePaths"]
    if not isinstance(frame_paths, list) or not frame_paths:
        raise ValueError("framePaths must be a non-empty list")
    threshold = float(request.get("threshold", DEFAULT_THRESHOLD))

    frames = segment_frames(frame_paths, request["outDir"], threshold)
    return {
        "ok": True,
        "task": "segment_person",
        "model": MODEL_NAME,
        "modelPath": str(MODEL_PATH),
        "threshold": threshold,
        "outDir": request["outDir"],
        "frames": frames,
    }


def _segment_overlay(request: dict) -> dict:
    """Debug renders for a pass that has already run.

    Separate from segmentation so that looking at a reel again costs a
    composite rather than an inference over every frame.
    """
    from .overlay import close_ups, contact_sheet

    frames = request["frames"]
    out_dir = request["outDir"]
    prefix = request["prefix"]

    sheet = contact_sheet(frames, f"{out_dir}/{prefix}-contactsheet.png")
    return {
        "ok": True,
        "task": "segment_overlay",
        "contactSheet": sheet,
        "closeUps": close_ups(frames, out_dir, prefix),
    }


def _compute_zones(request: dict) -> dict:
    from .zones import (
        BOTTOM_EXCLUSION,
        CLOSE_SAMPLES,
        LATERAL_INSET,
        MIN_ZONE_SHORT_EDGE,
        OPEN_SAMPLES,
        PERSON_COMPONENT_FLOOR,
        VERTICAL_INSET,
        ZONE_MARGIN,
        compute_zones,
    )

    frames = request["frames"]
    if not isinstance(frames, list) or not frames:
        raise ValueError("frames must be a non-empty list of {maskPath, timeS}")

    params = {
        "threshold": request.get("threshold"),
        "component_floor": float(request.get("componentFloor", PERSON_COMPONENT_FLOOR)),
        "zone_margin": float(request.get("zoneMargin", ZONE_MARGIN)),
        "min_zone_short_edge": float(
            request.get("minZoneShortEdge", MIN_ZONE_SHORT_EDGE)
        ),
        "bottom_exclusion": float(request.get("bottomExclusion", BOTTOM_EXCLUSION)),
        "lateral_inset": float(request.get("lateralInset", LATERAL_INSET)),
        "vertical_inset": float(request.get("verticalInset", VERTICAL_INSET)),
        "open_samples": int(request.get("openSamples", OPEN_SAMPLES)),
        "close_samples": int(request.get("closeSamples", CLOSE_SAMPLES)),
    }
    result = compute_zones(frames, **params)

    return {
        "ok": True,
        "task": "compute_zones",
        "sampleFps": request.get("sampleFps"),
        "width": result["width"],
        "height": result["height"],
        # Echoed so a result on disk carries the constants it was produced
        # with; they are chosen values and a later run may not share them.
        "params": params,
        "zones": result["zones"],
        "perFrame": result["perFrame"],
        "emptySamples": result["emptySamples"],
    }


def _zone_overlay(request: dict) -> dict:
    """Zone debug renders: a contact sheet, close-ups and a validity timeline."""
    from .overlay import close_ups, contact_sheet, timeline

    frames = request["frames"]
    out_dir = request["outDir"]
    prefix = request["prefix"]
    return {
        "ok": True,
        "task": "zone_overlay",
        "contactSheet": contact_sheet(frames, f"{out_dir}/{prefix}-contactsheet.png"),
        "closeUps": close_ups(frames, out_dir, prefix),
        "timeline": timeline(
            request["zones"], float(request["durationS"]), f"{out_dir}/{prefix}-timeline.png"
        ),
    }


def _component_overlay(request: dict) -> dict:
    """The frames whose largest dropped component is biggest, drawn."""
    from .overlay import component_render

    out_dir = request["outDir"]
    written = [
        component_render(entry, f"{out_dir}/{entry['name']}.png") for entry in request["entries"]
    ]
    return {"ok": True, "task": "component_overlay", "rendered": written}


def _component_stats(request: dict) -> dict:
    """Every mask's components, with what the floor would drop.

    Reads the stored masks and computes nothing else: no inference, no
    re-segmentation, and nothing on disk is modified.
    """
    from .zones import PERSON_COMPONENT_FLOOR, component_report, load_mask

    floor = float(request.get("componentFloor", PERSON_COMPONENT_FLOOR))
    threshold = request.get("threshold")
    frames = []
    for mask_path in request["maskPaths"]:
        mask = load_mask(mask_path, threshold)
        components = component_report(mask)
        # Mirrors filter_components exactly, which drops by absolute area and
        # does not exempt the largest component.
        for component in components:
            component["dropped"] = component["areaFrameFraction"] < floor
        frames.append({"maskPath": mask_path, "components": components})
    return {"ok": True, "task": "component_stats", "componentFloor": floor, "frames": frames}


def _short_edge_overlay(request: dict) -> dict:
    """One frame per reel with each zone's short edge dimensioned in source px."""
    from .overlay import short_edge_render
    from .zones import MIN_ZONE_SHORT_EDGE

    return {
        "ok": True,
        "task": "short_edge_overlay",
        "rendered": short_edge_render(
            request["framePath"],
            request["maskPath"],
            request["zones"],
            int(request["sourceWidth"]),
            int(request["sourceHeight"]),
            float(request.get("minShortEdge", MIN_ZONE_SHORT_EDGE)),
            request["outPath"],
        ),
    }


TASKS = {
    "remove_bg": _remove_bg,
    "detect_text": _detect_text,
    "segment_person": _segment_person,
    "segment_overlay": _segment_overlay,
    "compute_zones": _compute_zones,
    "component_stats": _component_stats,
    "zone_overlay": _zone_overlay,
    "short_edge_overlay": _short_edge_overlay,
    "component_overlay": _component_overlay,
}


def main() -> int:
    try:
        request = json.loads(sys.stdin.read())
    except json.JSONDecodeError as error:
        print(json.dumps({"ok": False, "error": f"stdin is not valid JSON: {error}"}))
        return 1

    task = request.get("task")
    handler = TASKS.get(task)
    if handler is None:
        print(json.dumps({"ok": False, "error": f"unknown task {task!r}; known: {sorted(TASKS)}"}))
        return 1

    try:
        print(json.dumps(handler(request)))
        return 0
    except Exception as error:  # noqa: BLE001 - the contract is JSON, always
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"ok": False, "task": task, "error": str(error)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
