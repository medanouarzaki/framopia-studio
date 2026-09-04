import { describe, expect, it } from 'vitest';
import { labelWords, matchClientPicture } from './client-pictures.js';
import type { ClientPicture } from './mode.js';

function picture(id: string, label?: string): ClientPicture {
  return {
    id,
    path: `/clients/somebody/${id}.png`,
    description: `a picture called ${id}`,
    ...(label === undefined ? {} : { label }),
  };
}

function said(...texts: string[]): { id: string; text: string }[] {
  return texts.map((text, i) => ({ id: `w${String(i + 1).padStart(3, '0')}`, text }));
}

describe('a label is a list of words', () => {
  it('splits on whitespace, commas and anything else that is not a letter', () => {
    expect(labelWords('Botox, Sculptra/Radiesse  Regenera')).toEqual([
      'botox', 'sculptra', 'radiesse', 'regenera',
    ]);
  });

  it('holds the two words of a two-word name, each on its own', () => {
    expect(labelWords('Skin Booster')).toEqual(['skin', 'booster']);
  });

  it('keeps Arabic letters as they are and does not case-fold them', () => {
    expect(labelWords('العيادة')).toEqual(['العيادة']);
  });

  it('says nothing for a label that is only punctuation, and for no label', () => {
    expect(labelWords('  ,, // ')).toEqual([]);
    expect(labelWords(undefined)).toEqual([]);
  });

  it('does not repeat a word written twice', () => {
    expect(labelWords('botox Botox BOTOX')).toEqual(['botox']);
  });
});

describe('a client’s picture is used when a word she says is in its label', () => {
  const pictures = [picture('pic001', 'Botox'), picture('pic002', 'Regenera')];

  it('matches the word, whatever case it was said in', () => {
    expect(matchClientPicture(pictures, said('كنديرو', 'BOTOX', 'مرة'))?.pictureId).toBe('pic001');
  });

  it('matches through the punctuation a transcript writes', () => {
    expect(matchClientPicture(pictures, said('Botox,'))?.pictureId).toBe('pic001');
  });

  it('reports the word that fired, so the choice is explicable', () => {
    expect(matchClientPicture(pictures, said('الصبح', 'Regenera'))).toEqual({
      pictureId: 'pic002',
      word: 'Regenera',
      wordId: 'w002',
    });
  });

  it('generates when nothing she said is on any label', () => {
    expect(matchClientPicture(pictures, said('كنديرو', 'مرة', 'فالسنة'))).toBeNull();
  });

  it('generates for a client with no pictures at all', () => {
    expect(matchClientPicture([], said('Botox'))).toBeNull();
  });

  it('generates for pictures nobody labelled, however many there are', () => {
    const unlabelled = Array.from({ length: 50 }, (_, i) => picture(`pic${i}`));
    expect(matchClientPicture(unlabelled, said('Botox'))).toBeNull();
  });

  it('works for a client with fifty labelled pictures', () => {
    const many = Array.from({ length: 50 }, (_, i) => picture(`pic${i}`, `thing${i}`));
    expect(matchClientPicture(many, said('THING37'))?.pictureId).toBe('pic37');
  });
});

/*
 * Strict is the whole ruling: he chose it over letting a model decide so that
 * it never surprises him. Each of these is a near-miss, and each generates.
 */
describe('strict means strict', () => {
  const pictures = [picture('pic001', 'Botox'), picture('pic002', 'العيادة')];

  it('does not match a word that merely contains the label', () => {
    expect(matchClientPicture(pictures, said('Botoxes'))).toBeNull();
    expect(matchClientPicture(pictures, said('Bot'))).toBeNull();
  });

  it('does not transliterate between scripts', () => {
    expect(matchClientPicture(pictures, said('بوتوكس'))).toBeNull();
    expect(matchClientPicture([picture('p', 'clinic')], said('العيادة'))).toBeNull();
  });

  it('does not fold Arabic letter forms into one another', () => {
    expect(matchClientPicture(pictures, said('العياده'))).toBeNull();
  });

  it('matches Arabic when it is written the same way', () => {
    expect(matchClientPicture(pictures, said('العيادة'))?.pictureId).toBe('pic002');
  });
});

describe('which word is tried, and which picture wins', () => {
  it('tries the naming word first, wherever it sits in the span', () => {
    const pictures = [picture('pic001', 'Regenera'), picture('pic002', 'Botox')];
    const spoken = said('Botox', 'و', 'Regenera');
    expect(matchClientPicture(pictures, spoken, 'w003')?.pictureId).toBe('pic001');
    // Without a naming word the span is read in the order it is spoken.
    expect(matchClientPicture(pictures, spoken)?.pictureId).toBe('pic002');
  });

  it('ignores a naming word that is not in the span', () => {
    const pictures = [picture('pic001', 'Botox')];
    expect(matchClientPicture(pictures, said('Botox'), 'w999')?.pictureId).toBe('pic001');
  });

  /*
   * There is no honest way to prefer one picture a client labelled over another
   * he labelled for the same word, so this invents none: it takes the first in
   * his own list, which is the order he added them and the only order he sees.
   */
  it('takes the first in the client’s own list when two both match', () => {
    const both = [picture('pic001', 'Botox'), picture('pic002', 'Botox')];
    expect(matchClientPicture(both, said('Botox'))?.pictureId).toBe('pic001');
    expect(matchClientPicture([both[1] as ClientPicture, both[0] as ClientPicture], said('Botox'))
      ?.pictureId).toBe('pic002');
  });
});
