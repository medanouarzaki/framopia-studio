import { describe, expect, it } from 'vitest';
import { buildAlignmentRows, type AlignmentRow } from './align-review.js';
import { renderSheet, type SheetInputs, type SheetRow } from './align-sheet.js';

/**
 * The generator emits JavaScript as text, and nothing type-checks the result.
 *
 * Block 8 session 11 put a literal newline inside a string literal there — an
 * escaping slip one level deep — and the sheet it produced had a script that
 * did not parse at all. It was caught by hand. Every value below reaches the
 * emitted source through `JSON.stringify`, and this asserts that what comes out
 * is still a program.
 */
function scriptOf(html: string): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  expect(match, 'the sheet emitted no inline script').not.toBeNull();
  return (match as RegExpExecArray)[1] as string;
}

function parses(html: string): void {
  // `new Function` compiles without running, which is what is wanted: the sheet
  // expects a DOM and this test has none.
  expect(() => new Function(scriptOf(html))).not.toThrow();
}

function sheet(over: Partial<SheetInputs> & { rows: SheetRow[] }): string {
  return renderSheet({
    reel: 'vitasilk',
    headSha: 'ff9d06c706fe2656713da3f0ec26ac1e357f26e5',
    generatedAt: '2026-08-28T00:00:00.000Z',
    cacheEntry: 'transcription-758a3924d090d1b5',
    promptVersion: 4,
    schemaVersion: 3,
    alignerHash: 'e9e63aebb60d6d84d1a1c0c9ad4a3d0e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    ...over,
  });
}

describe('the generated script is a program', () => {
  /* The shape that carried the download defect: sparse corrected-word indices. */
  it('parses over the sparse re-review row shape', () => {
    const draft = Array.from({ length: 60 }, (_, i) => ({ text: `د${i}`, start: i, end: i + 0.5 }));
    const all: AlignmentRow[] = buildAlignmentRows(draft, Array.from({ length: 60 }, (_, i) => `w${i}`));
    const rows = [0, 1, 2, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54].map(
      (i) => all[i] as SheetRow,
    );

    parses(sheet({ rows, variant: 'rereview', previousSha: '0'.repeat(40) }));
    parses(sheet({ rows }));
  });

  /*
   * Every character that has ever broken an emitted string: a quote of each
   * kind, a backslash, a real newline, a `</script>` that would close the tag,
   * and Arabic in both directions.
   */
  it('parses when the words carry quotes, backslashes, newlines and Arabic', () => {
    const nasty = [
      `it's a "quote"`,
      'back\\slash',
      'line\nbreak',
      'tab\there',
      '</script><script>alert(1)</script>',
      'ينغى, "مقتبس"',
      "l'acide `tick` ${notAnExpression}",
      'carriage\r\nreturn',
    ];
    const draft = nasty.map((t, i) => ({ text: t, start: i, end: i + 0.5 }));
    const rows = buildAlignmentRows(draft, nasty.map((t) => `${t} corrected`)) as SheetRow[];

    parses(sheet({ rows }));
    parses(sheet({ rows, variant: 'rereview', previousSha: '0'.repeat(40) }));
  });

  it('parses when a restored verdict carries an awkward word id', () => {
    const draft = [{ text: 'من', start: 0, end: 1 }];
    const rows = buildAlignmentRows(draft, ["mn'\\\"</script>"]) as SheetRow[];

    parses(sheet({ rows, restored: { [rows[0]!.wordId]: 'correct' } }));
  });

  /*
   * The exact slip: a newline that reached the emitted source unescaped. The
   * literal two characters backslash-n must survive into the program.
   */
  it('emits an escaped newline in the download, not a real one', () => {
    const rows = buildAlignmentRows([{ text: 'a', start: 0, end: 1 }], ['a']) as SheetRow[];
    const script = scriptOf(sheet({ rows }));
    const blobLine = script.split('\n').find((l) => l.includes('new Blob')) as string;

    expect(blobLine).toContain('\\n');
    expect(blobLine.endsWith(';')).toBe(true);
  });

  it('closes no tag it did not open', () => {
    const rows = buildAlignmentRows(
      [{ text: '</script>', start: 0, end: 1 }],
      ['</script> corrected'],
    ) as SheetRow[];
    const html = sheet({ rows });

    // One script element, whatever the data contained.
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    parses(html);
  });
});
