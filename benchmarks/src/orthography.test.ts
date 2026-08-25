import { describe, expect, it } from 'vitest';
import {
  editDistance,
  findFreezeListConformance,
  findDialAttachment,
  findOuConjunctions,
  findVowellessClusters,
  scoreOrthography,
  findProclitics,
} from './orthography.js';

describe('editDistance', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('bzaf', 'bzaf')).toBe(0);
  });

  it('is one for a single substitution', () => {
    expect(editDistance('bzzaf', 'bzaf')).toBe(1);
  });
});

describe('scoreOrthography — digit substitutions', () => {
  it('flags "5dma" for the banned 5-for-kh substitution', () => {
    const report = scoreOrthography(['5dma']);
    expect(report.digitSubstitutions.count).toBe(1);
    expect(report.digitSubstitutions.examples[0]?.word).toBe('5dma');
  });

  it('does not flag "khdma", the correct spelling', () => {
    const report = scoreOrthography(['khdma']);
    expect(report.digitSubstitutions.count).toBe(0);
  });

  it('does not flag 3/7/9, which are legitimate Arabizi letters', () => {
    const report = scoreOrthography(['3lach', '7ta', 'kan9olo']);
    expect(report.digitSubstitutions.count).toBe(0);
  });

  it('flags "2ndi" for the banned 2-for-hamza substitution', () => {
    const report = scoreOrthography(['2ndi']);
    expect(report.digitSubstitutions.count).toBe(1);
  });
});

describe('scoreOrthography — sh digraph', () => {
  it('flags words containing "sh" for review', () => {
    const report = scoreOrthography(['shno']);
    expect(report.shDigraph.count).toBe(1);
  });

  it('does not flag the correct "ch" spelling', () => {
    const report = scoreOrthography(['chno']);
    expect(report.shDigraph.count).toBe(0);
  });
});

describe('scoreOrthography — freeze list', () => {
  it('treats an exact frozen spelling as conformant', () => {
    const report = scoreOrthography(['bzaf']);
    expect(report.freezeList.totalOccurrences).toBe(1);
    expect(report.freezeList.conformant).toBe(1);
    expect(report.freezeList.nearMiss).toBe(0);
  });

  it('flags "bzzaf" as a near miss of frozen "bzaf"', () => {
    const report = scoreOrthography(['bzzaf']);
    expect(report.freezeList.totalOccurrences).toBe(1);
    expect(report.freezeList.nearMiss).toBe(1);
    expect(report.freezeList.examples[0]?.detail).toContain('bzaf');
  });

  it('does not match unrelated words against the freeze list', () => {
    const report = scoreOrthography(['salut']);
    expect(report.freezeList.totalOccurrences).toBe(0);
  });
});

describe('scoreOrthography — composite score', () => {
  it('is 1 for a clean transcript', () => {
    const report = scoreOrthography(['wach', 'nta', 'mzyan']);
    expect(report.score).toBe(1);
  });

  it('is 1 for an empty transcript', () => {
    expect(scoreOrthography([]).score).toBe(1);
  });

  it('drops below 1 when violations are present', () => {
    const report = scoreOrthography(['5dma', 'shno', 'bezzaf']);
    expect(report.score).toBeLessThan(1);
  });
});

describe('scoreOrthography — arabic script', () => {
  it('counts arabic-script words, which these latin rules cannot judge', () => {
    const report = scoreOrthography(['عندك', 'les', 'chno']);
    expect(report.arabicScriptWords).toBe(1);
  });
});

describe('freeze-list near-miss matching', () => {
  it('never reports an exact freeze-list hit as a near-miss of a neighbour', () => {
    // "bach" and "wach" are one edit apart and are different words. With both
    // on the list, an exact hit must win outright.
    const report = findFreezeListConformance(['bach', 'wach'], ['wach', 'bach']);
    expect(report.nearMiss).toBe(0);
    expect(report.conformant).toBe(2);
    expect(report.examples).toEqual([]);
  });

  it('applies the same precedence to frozen spellings that sit one edit apart', () => {
    const report = findFreezeListConformance(['dial', 'diali', 'kayn', 'kayna']);
    expect(report.nearMiss).toBe(0);
    expect(report.conformant).toBe(4);
  });

  it('still flags a genuine misspelling of a frozen word', () => {
    const report = findFreezeListConformance(['bzzaf'], ['bzaf']);
    expect(report.nearMiss).toBe(1);
    expect(report.examples[0]?.detail).toContain('bzaf');
  });

  // "bach" was frozen in ORTHOGRAPHY_GUIDE v1.0.4 precisely because the
  // matcher kept reporting it as a misspelling of "wach". Now that it is on
  // the list, the exact-match rule reaches it.
  it('counts bach as conformant now that v1.0.4 froze it', () => {
    const report = findFreezeListConformance(['bach']);
    expect(report.nearMiss).toBe(0);
    expect(report.conformant).toBe(1);
    expect(report.examples).toEqual([]);
  });

  it('leaves words under four characters out of the matcher entirely', () => {
    const report = findFreezeListConformance(['nta']);
    expect(report.totalOccurrences).toBe(0);
  });
});

describe('ou conjunction detection', () => {
  it('flags a standalone ou between two words', () => {
    const report = findOuConjunctions(['yom', 'ou', "l'effet"]);
    expect(report.count).toBe(1);
    expect(report.examples[0]?.word).toBe('ou');
  });

  it('flags a standalone ou carrying edge punctuation', () => {
    expect(findOuConjunctions(['yom', 'ou,', 'kay3tiw']).count).toBe(1);
  });

  it('does not flag ou as the long vowel inside a word', () => {
    // l7loul and houa are how run C actually spelled these; both are §3 /uː/.
    expect(findOuConjunctions(['l7loul', 'houa', 'nour', 'walou']).count).toBe(0);
  });

  it('does not flag ou inside a French root', () => {
    // ynourri, from the vitasilk reel, is nourrir per §5.
    expect(findOuConjunctions(['ynourri']).count).toBe(0);
  });

  it('leaves the correct w conjunction alone', () => {
    expect(findOuConjunctions(['yom', 'w', 'kay3tiw']).count).toBe(0);
  });

  it('does not reach into Arabic-script tokens', () => {
    expect(findOuConjunctions(['و', 'نتائج']).count).toBe(0);
  });
});

describe('vowel-less cluster detection', () => {
  it('flags the clusters the correction pass produced in session 3', () => {
    const report = findVowellessClusters(['7l', 'l7l']);
    expect(report.count).toBe(2);
    expect(report.examples.map((e) => e.word)).toEqual(['7l', 'l7l']);
  });

  it('treats 3, 7 and 9 as consonants rather than vowels', () => {
    expect(findVowellessClusters(['3ndhm']).count).toBe(1);
  });

  it('does not flag the vowel-bearing spellings of the same words', () => {
    expect(findVowellessClusters(['7el', 'l7el', 'awal', 'khdma']).count).toBe(0);
  });

  it('exempts the vowel-less words the guide already sanctions', () => {
    // f is frozen in §4; mn, nhdr and 3ndk are on the freeze list; w is the
    // §2 conjunction that findOuConjunctions exists to demand.
    expect(findVowellessClusters(['f', 'w', 'mn', 'nhdr', '3ndk']).count).toBe(0);
  });

  it('does not reach into Arabic script or bare digits', () => {
    expect(findVowellessClusters(['شعرك', '15', '4']).count).toBe(0);
  });

  it('ignores tokens that are not Latin script at all', () => {
    // Scribe emitted the CJK numeral 五 mid-sentence on the vitasilk reel.
    expect(findVowellessClusters(['五']).count).toBe(0);
  });

  it('ignores all-caps acronyms and product names', () => {
    expect(findVowellessClusters(['RRS']).count).toBe(0);
  });
});

describe('scoreOrthography — violations versus warnings', () => {
  it('counts an ou conjunction against the score', () => {
    const clean = scoreOrthography(['yom', 'wl7el', 'ghadi']);
    const dirty = scoreOrthography(['yom', 'ou', 'ghadi']);
    expect(clean.score).toBe(1);
    expect(dirty.ouConjunction.count).toBe(1);
    expect(dirty.score).toBeCloseTo(1 - 1 / 3, 12);
  });

  it('reports a vowel-less cluster as a warning without touching the score', () => {
    const report = scoreOrthography(['yom', 'ghadi', '7l']);
    expect(report.warnings.vowellessClusters.count).toBe(1);
    expect(report.warnings.vowellessClusters.examples[0]?.word).toBe('7l');
    expect(report.score).toBe(1);
  });

  it('leaves a clean Arabizi transcript at 100% despite dropped schwas', () => {
    // These are the correct spellings the rule used to penalise.
    const report = scoreOrthography(['ymkn', 'lik', 'diri', 'ch3rk', 'jbt', 'msbsb']);
    expect(report.score).toBe(1);
    expect(report.warnings.vowellessClusters.count).toBeGreaterThan(0);
  });

  it('still scores an ou conjunction when a warning is also present', () => {
    const report = scoreOrthography(['yom', 'ou', '7l']);
    expect(report.score).toBeCloseTo(1 - 1 / 3, 12);
    expect(report.warnings.vowellessClusters.count).toBe(1);
  });
});

describe('dial attachment', () => {
  it('accepts dial written separate from the word it governs', () => {
    expect(findDialAttachment(['joj', 'dial', 'l7loul']).count).toBe(0);
  });

  it('flags dial fused to the following noun', () => {
    // Both forms came out of identical calls in Block 2 session 4.
    const report = findDialAttachment(['joj', 'dl7loul']);
    expect(report.count).toBe(1);
    expect(report.examples[0]?.word).toBe('dl7loul');
  });

  it('flags every fused form the noise floor produced', () => {
    const report = findDialAttachment(['dl7loul', 'dl7essass', 'dlvitaminat']);
    expect(report.count).toBe(3);
  });

  it('flags the reduced dl and dla standing alone', () => {
    expect(findDialAttachment(['dl', 'dla']).count).toBe(2);
  });

  it('does not flag the pronoun suffixes §4 keeps attached', () => {
    expect(findDialAttachment(['diali', 'dialk', 'dialha', 'dialo', 'dialna']).count).toBe(0);
  });

  it('does not flag unrelated words that merely start with d', () => {
    expect(findDialAttachment(['daba', 'des', 'dernière', 'diri']).count).toBe(0);
  });

  it('ignores case and edge punctuation', () => {
    expect(findDialAttachment(['Dial', 'dialha,']).count).toBe(0);
    expect(findDialAttachment(['Dl7loul.']).count).toBe(1);
  });

  it('does not reach into Arabic script', () => {
    expect(findDialAttachment(['ديال', 'الحلول']).count).toBe(0);
  });
});

describe('scoreOrthography — dial is a scored violation', () => {
  it('counts a fused dial against the score', () => {
    const clean = scoreOrthography(['joj', 'dial', 'l7loul']);
    const fused = scoreOrthography(['joj', 'dl7loul']);
    expect(clean.score).toBe(1);
    expect(fused.dialAttachment.count).toBe(1);
    expect(fused.score).toBeCloseTo(0.5, 12);
  });
});

describe('findProclitics', () => {
  it('flags a standalone latin conjunction, either case', () => {
    expect(findProclitics(['Mabin', '7essa', 'w', '7essa']).count).toBe(1);
    expect(findProclitics(['W', 'bdebt', '3la']).count).toBe(1);
  });

  // §2 states the rule for Arabic script with the same letter.
  it('flags a standalone arabic conjunction', () => {
    expect(findProclitics(['إشراقة', 'و', 'نضارة']).count).toBe(1);
  });

  it('flags a standalone definite article', () => {
    expect(findProclitics(['wa7d', 'l', 'cocktail']).count).toBe(1);
  });

  // v1.0.8: the conjunction before an Arabic-script term fuses in Arabic
  // script. The message has to name that, because "attach it" applied
  // literally would produce the mixed-script token §8 forbids.
  it('names the arabic fusion when the next token is arabic script', () => {
    const report = findProclitics(['réticulé', 'w', 'مادة', 'الكافيين']);
    expect(report.count).toBe(1);
    expect(report.examples[0]?.detail).toContain('ومادة');
    expect(report.examples[0]?.detail).toContain('v1.0.8');
  });

  it('does not name the arabic fusion when the next token is latin', () => {
    const report = findProclitics(['Mabin', 'w', '7essa']);
    expect(report.count).toBe(1);
    expect(report.examples[0]?.detail).not.toContain('ومادة');
  });

  it('flags a standalone w at the very end, with nothing following', () => {
    expect(findProclitics(['7essa', 'w']).count).toBe(1);
  });

  it('passes the attached forms the guide asks for', () => {
    expect(findProclitics(['Mabin', '7essa', 'w7essa', '15', 'yom']).count).toBe(0);
    expect(findProclitics(['إشراقة', 'ونضارة']).count).toBe(0);
    expect(findProclitics(['réticulé', 'ومادة', 'الكافيين']).count).toBe(0);
    expect(findProclitics(['wa7d', 'lcocktail', 'dial', 'lvitaminat']).count).toBe(0);
    expect(findProclitics(['Wl’effet', 'dialha']).count).toBe(0);
  });

  // v1.0.7 explicitly preserves a French noun's French article, and an
  // elided l' is French spelling under §5. Neither is this defect.
  it('does not flag french articles or an elided l apostrophe', () => {
    expect(findProclitics(['dial', 'la', 'vidéo']).count).toBe(0);
    expect(findProclitics(['3la', 'le', 'RRS', 'eyes']).count).toBe(0);
    expect(findProclitics(["l'acide", 'hyaluronique']).count).toBe(0);
    expect(findProclitics(['l’ADN', 'du', 'saumon']).count).toBe(0);
  });

  it('sees through edge punctuation', () => {
    expect(findProclitics(['w,']).count).toBe(1);
    expect(findProclitics(['"l"']).count).toBe(1);
  });

  it('counts toward the scored violations, not the warnings', () => {
    const clean = scoreOrthography(['yom', 'nhdr', 'likom']);
    const dirty = scoreOrthography(['yom', 'w', 'nhdr', 'likom']);
    expect(clean.proclitic.count).toBe(0);
    expect(clean.score).toBe(1);
    expect(dirty.proclitic.count).toBe(1);
    expect(dirty.score).toBeCloseTo(1 - 1 / 4, 12);
  });
});
