"""The sidecar entry point.

Contract: one JSON object on stdin, one JSON object on stdout, nothing else on
stdout ever. Progress, warnings and tracebacks go to stderr, because the
caller parses stdout and a stray print would corrupt a result rather than
merely clutter a log.

    {"task": "remove_bg", "imagePath": "...", "outPath": "...",
     "alphaMatting": false, "ocr": true}

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


TASKS = {"remove_bg": _remove_bg, "detect_text": _detect_text}


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
