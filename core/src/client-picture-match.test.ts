import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { clientKeyterms, labelWords, matchClientPicture } from './client-pictures.js';
import { REPO_ROOT } from './paths.js';
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

/**
 * **The words this client has told us matter, handed to the transcriber.**
 *
 * Block 12 session 85: Dr Loubna Kfafi says "wela Planiti" and the transcriber,
 * which has never heard the name of a Korean skin booster, returned "Lanluma".
 * Nothing was ever looked for, so no picture could be placed for a product she
 * plainly named — and her fourteen labels were on her client file the whole
 * time. The same statement the matcher reads, used one step earlier.
 */
describe('the words a client has labelled', () => {
  const pic = (id: string, label: string): ClientPicture =>
    ({ id, path: `/p/${id}.jpg`, description: '', label }) as ClientPicture;

  it('are every word on every label, once each', () => {
    const mode = { pictures: [pic('a', 'profhilo'), pic('b', 'neauvia, stimulate')] };
    expect(clientKeyterms(mode)).toEqual(['profhilo', 'neauvia', 'stimulate']);
  });

  it('does not repeat a word two pictures share', () => {
    const mode = { pictures: [pic('a', 'profhilo'), pic('b', 'profhilo, structura')] };
    expect(clientKeyterms(mode)).toEqual(['profhilo', 'structura']);
  });

  it('is empty for a client who has labelled nothing', () => {
    expect(clientKeyterms({ pictures: [] })).toEqual([]);
    expect(clientKeyterms({ pictures: [pic('a', '')] })).toEqual([]);
  });

  /* A reel's own pictures are the more specific statement, so they come first. */
  it('puts a reel’s own pictures before the client’s', () => {
    const mode = { pictures: [pic('a', 'profhilo')] };
    expect(clientKeyterms(mode, [pic('own', 'planiti')])).toEqual(['planiti', 'profhilo']);
  });

  /* Same client, same list, so a cache key over it does not drift. */
  it('gives the same list twice', () => {
    const mode = { pictures: [pic('a', 'profhilo'), pic('b', 'sculptra')] };
    expect(clientKeyterms(mode)).toEqual(clientKeyterms(mode));
  });

  /*
   * **It cannot put a word in her mouth**, and that is not this function's job:
   * it produces a list, and the correction prompt says "if spoken". This pins
   * that wording, because it is the whole of the protection.
   */
  it('is offered to the model only for words that are spoken', () => {
    const correction = readFileSync(
      path.join(REPO_ROOT, 'service', 'src', 'transcription', 'correction.ts'),
      'utf8',
    );
    expect(correction).toContain('Keyterms to recognize accurately if spoken');
  });
});
