"""Mockable Gemini client for ASR, understanding, and image generation (spec §6.2–6.4).

This module is a THIN TRANSPORT + RETRY LAYER. It does NOT contain any prompt
engineering, output shaping, or stage logic — those belong in T-105 (ASR stage),
T-108 (understanding stage), and T-111 (image stage).

## Injectable seam (the core deliverable for T-104)

The client takes an optional `transport` callable on construction. In tests, pass
a callable that returns pre-recorded fixture dicts (see tests/fixtures/gemini/).
In production, leave `transport` unset and the real HTTP transport is used.

Transport signature::

    transport(method: str, model_id: str, payload: dict, api_key: str) -> dict

Where:
- ``method`` is one of ``"text"`` or ``"image"``
- ``model_id`` is the Gemini model identifier string
- ``payload`` is the request body dict
- ``api_key`` is the raw (unwrapped) key — NEVER log this

Response format (internal — not the raw Gemini REST format, translated by
_http_transport for production use):
- text calls: ``{"text": str, "model_id": str}``
- image calls: ``{"image_bytes_b64": str, "model_id": str}``  # base64-encoded PNG

Example test usage::

    def my_transport(method, model_id, payload, api_key):
        data = json.loads((FIXTURES / f"{method}_response.json").read_text())
        return data

    client = GeminiClient(transport=my_transport, backoff_s=0)
    result = client.transcribe(audio_path)

## Secrets discipline

The raw API key is obtained via ``get_settings().gemini_api_key.get_secret_value()``.
It is passed to the transport callable but MUST NOT appear in any exception message,
log entry, or repr. The transport is the only code that uses it, and it must observe
the same rule.
"""

from __future__ import annotations

import base64
import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.config import get_settings
from app.util.cost import CostMeter

# ---------------------------------------------------------------------------
# Error hierarchy
# ---------------------------------------------------------------------------


class GeminiError(RuntimeError):
    """Non-retryable Gemini error (auth failure, bad request, etc.).

    Follows the established pattern from FfmpegError / AudioError:
    a public RuntimeError subclass with a human-readable message.
    """


class GeminiTransientError(GeminiError):
    """Retryable Gemini error: timeout, 429 rate-limit, or 5xx server error.

    The client automatically retries up to ``max_attempts`` times with
    ``backoff_s`` seconds between attempts (set ``backoff_s=0`` in tests).
    """


# ---------------------------------------------------------------------------
# Cost estimates per image (D-024)
# ---------------------------------------------------------------------------

_COST_NANO_BANANA_2_USD: float = 0.04   # ~4¢/image per spec §6.4
_COST_NANO_BANANA_PRO_USD: float = 0.08  # ~2× default per spec §6.4


# ---------------------------------------------------------------------------
# Return types
# ---------------------------------------------------------------------------


@dataclass
class TranscriptSegment:
    """One transcribed speech segment with rough timing.

    T-105 owns the ASR prompt that shapes Gemini's output into this structure.
    The ``text`` is the transcribed words for this segment; ``script`` is
    ``"arabic"`` or ``"latin"`` (or None when mixed within the segment).
    """

    text: str
    start: float | None = None
    end: float | None = None
    confidence: float | None = None
    script: str | None = None


@dataclass
class TranscribeResult:
    """Result of a Gemini transcription call.

    ``segments`` is parsed from Gemini's JSON output (T-105 prompts the model
    to emit a JSON array of segment objects). If parsing fails, one segment
    with ``start=None, end=None`` is returned so the pipeline degrades
    gracefully. ``raw_text`` is the model's verbatim output for debugging.
    """

    segments: list[TranscriptSegment]
    model_id: str
    raw_text: str


@dataclass
class UnderstandResult:
    """Result of a Gemini understanding call.

    T-108 owns the prompt and parses ``raw_text`` into ``understanding.json``.
    This client is intentionally opaque to the output structure.
    """

    raw_text: str
    model_id: str


@dataclass
class ImageResult:
    """Result of a Gemini image generation call."""

    image_bytes: bytes
    model_id: str


# ---------------------------------------------------------------------------
# Transport type alias
# ---------------------------------------------------------------------------

GeminiTransport = Callable[[str, str, dict, str], dict]


# ---------------------------------------------------------------------------
# Key accessor (internal — never log the returned value)
# ---------------------------------------------------------------------------


def _get_api_key() -> str:
    """Return the raw Gemini API key.

    Raises GeminiError if the key is not configured. The caller MUST NOT log
    or embed the returned value in any exception message or repr.
    """
    s = get_settings()
    if s.gemini_api_key is None:
        raise GeminiError(
            "No Gemini API key configured. "
            "Set GEMINI_API_KEY in .env and restart the backend."
        )
    return s.gemini_api_key.get_secret_value()


# ---------------------------------------------------------------------------
# Production HTTP transport (uses httpx; never called in tests)
# ---------------------------------------------------------------------------

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def _http_transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
    """Real Gemini REST transport.

    NEVER called in tests — inject a fixture transport instead (see module docstring).
    The ``api_key`` parameter is used only in the Authorization header; it is
    never logged, printed, or embedded in error messages here.
    """
    if method == "text":
        url = f"{_GEMINI_BASE}/{model_id}:generateContent"
        resp = httpx.post(
            url,
            headers={"x-goog-api-key": api_key},
            json=payload,
            timeout=60.0,
        )
    elif method == "image":
        url = f"{_GEMINI_BASE}/{model_id}:generateImages"
        resp = httpx.post(
            url,
            headers={"x-goog-api-key": api_key},
            json=payload,
            timeout=120.0,
        )
    else:
        raise GeminiError(f"Unknown transport method: {method!r}")

    # Transient errors: 429, 5xx, network timeout
    if resp.status_code == 429 or resp.status_code >= 500:
        raise GeminiTransientError(
            f"Gemini returned {resp.status_code} for model {model_id!r}. "
            "Will retry."
        )
    # Non-transient errors: 4xx auth / bad request
    if resp.status_code >= 400:
        raise GeminiError(
            f"Gemini returned {resp.status_code} for model {model_id!r}. "
            "Check the API key and request format."
        )

    data = resp.json()

    # Translate from Gemini REST format to internal format
    if method == "text":
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise GeminiError(
                f"Unexpected response structure from {model_id!r}: {exc}"
            ) from exc
        return {"text": text, "model_id": data.get("modelVersion", model_id)}

    # image
    try:
        part = data["candidates"][0]["content"]["parts"][0]
        b64 = part["inlineData"]["data"]
    except (KeyError, IndexError) as exc:
        raise GeminiError(
            f"Unexpected image response structure from {model_id!r}: {exc}"
        ) from exc
    return {"image_bytes_b64": b64, "model_id": data.get("modelVersion", model_id)}


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class GeminiClient:
    """Thin, mockable wrapper around the Gemini API (spec §6.2–6.4).

    All three pipeline uses are exposed as typed methods. The ``transport``
    parameter is the primary test seam — see the module docstring for usage.

    Args:
        transport: Optional callable that replaces the real HTTP call.
                   Inject in tests; leave None for production.
        max_attempts: Maximum number of attempts on transient errors (default 3).
        backoff_s: Seconds to wait between retries (set to 0 in tests, D-025).
    """

    def __init__(
        self,
        *,
        transport: GeminiTransport | None = None,
        max_attempts: int = 3,
        backoff_s: float = 1.0,
    ) -> None:
        self._transport: GeminiTransport = transport if transport is not None else _http_transport
        self._max_attempts = max_attempts
        self._backoff_s = backoff_s

    # ------------------------------------------------------------------
    # Internal: call with retry
    # ------------------------------------------------------------------

    def _call(self, method: str, model_id: str, payload: dict) -> dict:
        """Invoke the transport with bounded retry on transient errors.

        Non-transient GeminiErrors propagate immediately. After all attempts
        are exhausted, the last transient error is re-raised.
        The api_key is passed here so it never leaks into retry-loop logging.
        """
        api_key = _get_api_key()
        last_exc: GeminiTransientError | None = None
        for attempt in range(self._max_attempts):
            try:
                return self._transport(method, model_id, payload, api_key)
            except GeminiTransientError as exc:
                last_exc = exc
                if attempt < self._max_attempts - 1:
                    time.sleep(self._backoff_s)
            # Non-transient: let it propagate immediately (no retry)
        raise last_exc  # type: ignore[misc]

    # ------------------------------------------------------------------
    # transcribe
    # ------------------------------------------------------------------

    def transcribe(
        self,
        audio_path: Path,
        *,
        prompt: str | None = None,
        brief: str | None = None,
    ) -> TranscribeResult:
        """Transcribe a WAV/MP4 audio file via Gemini.

        T-105 (ASR stage) owns the prompt engineering and passes it via
        ``prompt``. If omitted, a minimal default is used that instructs the
        model to output a JSON array of segment objects (good enough for smoke
        tests; not the production-quality §11 script-and-code-switch prompt).

        Returns a TranscribeResult with segments parsed from the model's JSON
        output. If the model output is not valid JSON, one segment is returned
        with the full raw text so the pipeline degrades gracefully.

        Args:
            audio_path: Path to the audio file (audio.wav or input.mp4).
            prompt: System/user prompt override. Pass None to use the minimal default.
            brief: Optional operator brief for domain context (brand names, etc.).
        """
        model_id = get_settings().gemini_text_model

        audio_b64 = base64.b64encode(Path(audio_path).read_bytes()).decode()
        default_prompt = (
            "Transcribe the audio. "
            "Output a JSON array of objects with keys: "
            'text (string), start (float seconds), end (float seconds), '
            'confidence (float 0-1, optional), script ("arabic"|"latin"|null). '
            "Preserve French/English words in Latin script; "
            "Darija/Arabic words in Arabic script."
        )
        parts: list[dict] = [
            {"text": prompt or default_prompt},
            {
                "inlineData": {
                    "mimeType": "audio/wav",
                    "data": audio_b64,
                }
            },
        ]
        if brief:
            parts.insert(0, {"text": f"Context: {brief}"})

        payload = {"contents": [{"parts": parts, "role": "user"}]}
        response = self._call("text", model_id, payload)

        raw_text: str = response["text"]
        out_model_id: str = response.get("model_id", model_id)
        segments = _parse_segments(raw_text)
        return TranscribeResult(segments=segments, model_id=out_model_id, raw_text=raw_text)

    # ------------------------------------------------------------------
    # understand
    # ------------------------------------------------------------------

    def understand(
        self,
        *,
        transcript: str,
        prompt: str | None = None,
        words: list | None = None,
        brief: str | None = None,
    ) -> UnderstandResult:
        """Send the corrected transcript to Gemini for understanding / segmentation.

        T-108 (understanding stage) owns the prompt and parses ``raw_text``
        into ``understanding.json``. This method is intentionally opaque to
        the output structure.

        Args:
            transcript: Human-corrected full transcript text.
            prompt: Prompt override for T-108. If None, a minimal placeholder is used.
            words: Optional word-level timing list (from words.json) for richer context.
            brief: Operator brief for domain context.
        """
        model_id = get_settings().gemini_text_model

        default_prompt = (
            "Analyse the transcript and output a JSON object with: "
            "summary (string), segments (array of {start_word_idx, end_word_idx, "
            "visual_intent (string), emphasis_words (array of strings)})."
        )
        parts: list[dict] = [{"text": prompt or default_prompt}]
        if brief:
            parts.append({"text": f"Brief: {brief}"})
        parts.append({"text": f"Transcript:\n{transcript}"})
        if words:
            parts.append({"text": f"Word timings (JSON):\n{json.dumps(words)}"})

        payload = {"contents": [{"parts": parts, "role": "user"}]}
        response = self._call("text", model_id, payload)

        return UnderstandResult(
            raw_text=response["text"],
            model_id=response.get("model_id", model_id),
        )

    # ------------------------------------------------------------------
    # generate_image
    # ------------------------------------------------------------------

    def generate_image(
        self,
        prompt: str,
        *,
        model: str | None = None,
        meter: CostMeter | None = None,
    ) -> ImageResult:
        """Generate an image via Nano Banana 2 (or Pro if model= is passed).

        T-111 (image stage) decides when to escalate to the Pro model (hero shots).
        This method honors the ``model`` argument without questioning it.

        The cost meter is incremented after a SUCCESSFUL generation. When
        ``model`` is set to the Pro model id, the Pro cost estimate is used;
        all other models use the default Nano Banana 2 estimate (D-024).

        Args:
            prompt: Image generation prompt.
            model: Model id override. Defaults to ``settings.gemini_image_model``.
            meter: Optional CostMeter to track estimated spend.
        """
        settings = get_settings()
        model_id = model or settings.gemini_image_model

        payload = {
            "contents": [{"parts": [{"text": prompt}], "role": "user"}],
            "generationConfig": {"responseModalities": ["IMAGE"]},
        }
        response = self._call("image", model_id, payload)

        image_bytes = base64.b64decode(response["image_bytes_b64"])
        out_model_id: str = response.get("model_id", model_id)

        # Increment cost meter after successful generation
        if meter is not None:
            cost = (
                _COST_NANO_BANANA_PRO_USD
                if model_id == settings.gemini_image_pro_model
                else _COST_NANO_BANANA_2_USD
            )
            meter.add(cost)

        return ImageResult(image_bytes=image_bytes, model_id=out_model_id)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_segments(raw_text: str) -> list[TranscriptSegment]:
    """Parse a JSON-array model output into TranscriptSegment objects.

    If the text is not valid JSON or not an array, returns one segment with
    the full text and no timing so the pipeline degrades gracefully.
    T-105 is responsible for prompting the model to produce valid JSON.
    """
    try:
        data = json.loads(raw_text.strip())
    except json.JSONDecodeError:
        return [TranscriptSegment(text=raw_text.strip())]

    if not isinstance(data, list):
        return [TranscriptSegment(text=raw_text.strip())]

    segments: list[TranscriptSegment] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        segments.append(
            TranscriptSegment(
                text=item.get("text", ""),
                start=item.get("start"),
                end=item.get("end"),
                confidence=item.get("confidence"),
                script=item.get("script"),
            )
        )
    return segments or [TranscriptSegment(text=raw_text.strip())]
