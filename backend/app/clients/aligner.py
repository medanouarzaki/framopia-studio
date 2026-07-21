"""Forced-alignment client interface and WhisperX adapter.

Public interface
----------------
``AlignerCallable`` is the type contract every aligner must satisfy:

    (audio_path: Path, words: list[str]) -> list[tuple[float, float]]
    # Returns one (start_s, end_s) timing per input word, in the same order.

``make_whisperx_aligner()`` is the production adapter — it returns an
``AlignerCallable`` backed by WhisperX forced alignment.  Heavy imports
(``torch``, ``whisperx``) live INSIDE the returned closure so that importing
this module NEVER requires those packages to be installed.  The unit-test
suite injects a fake ``AlignerCallable`` instead.

T-003 install flag
------------------
``mac_setup.sh`` must install the WhisperX stack:
    pip install whisperx
    pip install torch torchvision torchaudio
    # Download model at first use (auto via HuggingFace cache):
    #   jonatasgrosman/wav2vec2-large-xlsr-53-arabic
See PROGRESS.md T-107 entry for the full install note.

Design choice (D-030)
---------------------
WhisperX is chosen over MFA / aeneas because it:
  - accepts seeded text (aligns GIVEN words, does not re-transcribe),
  - is pip-installable on macOS (no conda / kaldi),
  - supports Arabic via HuggingFace wav2vec2 models adequate for Darija
    phonetics.
Mixed-script limitation: a single Arabic model is used for the whole segment;
French/English word timings are adequate (±100 ms) for caption display.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path


class AlignerError(RuntimeError):
    """Raised when the forced-alignment backend fails.

    The message is human-readable and safe to surface to the operator.
    """


# Type contract: every aligner callable must match this signature.
AlignerCallable = Callable[[Path, list[str]], list[tuple[float, float]]]


def make_whisperx_aligner(
    *,
    model_name: str = "jonatasgrosman/wav2vec2-large-xlsr-53-arabic",
    language: str = "ar",
    device: str = "cpu",
) -> AlignerCallable:
    """Create a WhisperX forced-alignment callable.

    Calling this function is lightweight (no imports).  The heavy imports
    (``torch``, ``whisperx``) happen inside the returned callable on first use.

    Args:
        model_name: HuggingFace wav2vec2 model identifier.  The default is the
                    Arabic XLSR-53 model, which covers Moroccan Darija phonetics
                    adequately (D-030).  Override via ALIGNER_MODEL in ``.env``
                    if needed.
        language:   Language code passed to ``whisperx.load_align_model``.
                    ``"ar"`` for Arabic/Darija segments; ``"fr"`` for French-heavy
                    content.
        device:     ``"cpu"`` or ``"cuda"``.  Default ``"cpu"`` is adequate for
                    ~30 s reels on M-series Macs (no GPU required for v1).

    Returns:
        An ``AlignerCallable`` that aligns the given word list to the given audio.
    """

    def whisperx_align(audio_path: Path, words: list[str]) -> list[tuple[float, float]]:
        """Align *words* to *audio_path* using WhisperX forced alignment.

        Passes all words as a single seeded segment so WhisperX aligns the
        GIVEN words, not re-transcribed ones.  Mixed-script segments use the
        configured (Arabic by default) model for the full segment; French/English
        word timings are adequate for caption display (D-030).
        """
        try:
            import whisperx  # noqa: PLC0415
        except ImportError as exc:
            raise AlignerError(
                "WhisperX is not installed.\n"
                "Install: pip install whisperx torch torchvision torchaudio\n"
                "See PROGRESS.md T-107 entry for the full T-003 setup note."
            ) from exc

        try:
            audio = whisperx.load_audio(str(audio_path))
            # Present all words as one segment with pre-set text.
            # WhisperX align() aligns GIVEN text — it does NOT re-transcribe.
            segments = [{"text": " ".join(words), "start": 0.0, "end": None}]
            align_model, metadata = whisperx.load_align_model(
                language_code=language,
                device=device,
                model_name=model_name,
            )
            result = whisperx.align(
                segments,
                align_model,
                metadata,
                audio,
                device,
                return_char_alignments=False,
            )
        except AlignerError:
            raise
        except Exception as exc:
            raise AlignerError(f"WhisperX alignment failed: {exc}") from exc

        word_segments = result.get("word_segments", [])
        return [
            (float(ws.get("start", 0.0)), float(ws.get("end", 0.0)))
            for ws in word_segments
        ]

    return whisperx_align
