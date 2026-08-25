"""The text correctness check on cases where the answer is known."""

import pytest

from framopia_cv.text_check import check_text, content_words, expected_vocabulary, normalise

IDEA = "A cosmetic bottle of hair serum on a presentation podium"


class TestNormalise:
    def test_casefolds_and_collapses_whitespace(self):
        assert normalise("  HAIR   Serum ") == "hair serum"

    # The mode vocabulary is written the way a human writes it; an OCR reader
    # may or may not resolve the accent. Folding stops a match reading as
    # unexpected.
    def test_strips_accents(self):
        assert normalise("caféine") == normalise("CAFEINE")


class TestContentWords:
    def test_drops_function_words(self):
        assert "of" not in content_words(IDEA)
        assert "the" not in content_words("the bottle")

    def test_drops_short_glyphs(self):
        assert content_words("a bb ccc") == {"ccc"}

    def test_keeps_the_words_that_make_a_claim(self):
        assert {"hair", "serum", "bottle"} <= content_words(IDEA)


class TestExpectedVocabulary:
    def test_covers_the_idea(self):
        assert "serum" in expected_vocabulary(IDEA, [])

    def test_covers_the_client_vocabulary(self):
        assert "profhilo" in expected_vocabulary(IDEA, ["Profhilo"])


class TestCheckText:
    # The regression case: the pro image that carried HAIR SERUM was a
    # presence failure under the old check and is correct under this one.
    def test_text_matching_the_idea_passes_clean(self):
        verdict = check_text(["HAIR", "SERUM"], IDEA, [])
        assert verdict.ok
        assert verdict.has_text
        assert verdict.expected == ["hair", "serum"]
        assert verdict.unexpected == []

    def test_invented_branding_is_flagged(self):
        verdict = check_text(["LUXE PARIS"], IDEA, [])
        assert not verdict.ok
        assert verdict.unexpected == ["luxe", "paris"]

    def test_a_client_term_passes(self):
        assert check_text(["VITA SILK"], IDEA, ["Vita Silk"]).ok

    def test_no_text_is_ok_and_has_no_text(self):
        verdict = check_text([], IDEA, [])
        assert verdict.ok
        assert not verdict.has_text

    def test_mixed_text_reports_only_the_unexpected(self):
        verdict = check_text(["SERUM", "LUXE"], IDEA, [])
        assert verdict.expected == ["serum"]
        assert verdict.unexpected == ["luxe"]
        assert not verdict.ok

    # A detection of pure function words made no claim, so there is nothing
    # to be right or wrong about.
    def test_stopwords_alone_are_neither(self):
        verdict = check_text(["the of and"], IDEA, [])
        assert verdict.expected == []
        assert verdict.unexpected == []
        assert not verdict.has_text

    def test_is_case_and_accent_insensitive(self):
        assert check_text(["caféine"], "a caffeine molecule", ["Caféine"]).ok

    def test_deduplicates_across_detections(self):
        verdict = check_text(["SERUM", "serum"], IDEA, [])
        assert verdict.expected == ["serum"]
