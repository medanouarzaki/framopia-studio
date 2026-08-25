"""Local OCR over a generated candidate.

A negative prompt is not a control. One of the six Block 4 images rendered a
legible English product label despite `no text, no watermark, no logo` in the
negative prompt, on a reel that is Darija for a Moroccan clinic. PROJECT_SPEC
§5 forbids visible watermarks and §1 forbids a generic AI look, so text has to
be **detected**, not requested away.

RapidOCR (ONNX) rather than tesseract or easyocr: no system binary to install,
the same onnxruntime the background remover already pulls in, and no network
at inference time.

The flag is advisory. It surfaces to the editor and is recorded on the
candidate; nothing is deleted on its say-so, because a false positive on a
texture that looks like lettering must not silently drop a good image.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

# Below this the detection is more likely a texture than a glyph. Generous on
# purpose: a missed watermark is worse than a spurious flag an editor
# dismisses. Provisional, like the gate thresholds.
MIN_CONFIDENCE = 0.5

# One or two stray glyphs are noise; a word is text. Length is measured after
# stripping whitespace.
MIN_TEXT_LENGTH = 2


@dataclass(frozen=True)
class DetectedText:
    text: str
    confidence: float

    def to_dict(self) -> dict[str, object]:
        return {"text": self.text, "confidence": round(self.confidence, 4)}


@dataclass(frozen=True)
class OcrResult:
    has_text: bool
    detections: list[DetectedText] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "hasText": self.has_text,
            "detections": [d.to_dict() for d in self.detections],
        }


@lru_cache(maxsize=1)
def _engine():
    from rapidocr_onnxruntime import RapidOCR

    return RapidOCR()


def detect_text(image_path: str) -> OcrResult:
    result, _ = _engine()(image_path)
    detections: list[DetectedText] = []
    for entry in result or []:
        # RapidOCR returns [box, text, confidence] per detection.
        _, text, confidence = entry[0], entry[1], float(entry[2])
        cleaned = " ".join(str(text).split())
        if len(cleaned) < MIN_TEXT_LENGTH or confidence < MIN_CONFIDENCE:
            continue
        detections.append(DetectedText(text=cleaned, confidence=confidence))

    return OcrResult(has_text=bool(detections), detections=detections)
