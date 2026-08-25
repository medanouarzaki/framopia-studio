"""Checking detected text against what the slot is supposed to depict.

Text is permitted since Block 4 session 5 — `no text` never worked as a
negative prompt and was removed. What is not permitted is **uncontrolled**
text: Block 2 recorded one brand name emerging three ways across three
identical calls, and a product label the model invented is the same failure
wearing a different hat.

So the check is a correctness check, not a presence check. Detected words are
compared against what the slot claims to be about — the client's own
vocabulary plus the content words of the slot's `idea` — and anything outside
that is reported as unexpected.

The verdict is **advisory**. It names words; it does not delete, reject or
re-roll. A false positive on a stylised texture must not silently drop a good
candidate, and the editor is the one who decides.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# Function words carry no depiction claim, so they neither establish an
# expectation nor violate one. Kept deliberately small: this list exists to
# stop "of" in an idea from licensing "of" on a label, not to do linguistics.
STOPWORDS = frozenset(
    """a an and are as at be by for from in into is it its of on onto or over
    that the their to with within without""".split()
)

# Two characters or fewer is a glyph, not a word. Matches the OCR reader's own
# floor so the two do not disagree about what counts as text.
MIN_WORD_LENGTH = 3

_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


def normalise(text: str) -> str:
    """Casefold, strip accents, collapse whitespace.

    Accent-stripping matters: the mode vocabulary is written the way a human
    writes it (`caféine`) and an OCR reader may or may not resolve the accent,
    so comparing them without folding would report a match as unexpected.
    """
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(stripped.casefold().split())


def content_words(text: str) -> set[str]:
    """The words in `text` that make a claim about what is depicted."""
    return {
        word
        for word in _WORD_RE.findall(normalise(text))
        if len(word) >= MIN_WORD_LENGTH and word not in STOPWORDS
    }


def expected_vocabulary(idea: str, mode_vocabulary: list[str]) -> set[str]:
    """What this slot is allowed to say.

    The slot's own idea, because an image of a serum bottle may legibly say
    "serum", plus the client's vocabulary, because a brand name on a product
    is the point rather than a defect.
    """
    expected: set[str] = content_words(idea)
    for term in mode_vocabulary:
        expected |= content_words(term)
    return expected


@dataclass(frozen=True)
class TextVerdict:
    has_text: bool
    expected: list[str]
    unexpected: list[str]

    @property
    def ok(self) -> bool:
        return not self.unexpected

    def to_dict(self) -> dict[str, object]:
        return {
            "hasText": self.has_text,
            "expected": list(self.expected),
            "unexpected": list(self.unexpected),
            "ok": self.ok,
        }


def check_text(detected: list[str], idea: str, mode_vocabulary: list[str]) -> TextVerdict:
    """Split what was read into expected and unexpected.

    A detection whose words are all stopwords or single glyphs lands in
    neither list: it made no claim, so there is nothing to be right or wrong
    about.
    """
    allowed = expected_vocabulary(idea, mode_vocabulary)

    expected: list[str] = []
    unexpected: list[str] = []
    for word in sorted({w for phrase in detected for w in content_words(phrase)}):
        (expected if word in allowed else unexpected).append(word)

    return TextVerdict(
        has_text=bool(expected or unexpected),
        expected=expected,
        unexpected=unexpected,
    )
