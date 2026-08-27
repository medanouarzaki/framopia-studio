// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAlignmentRows } from './align-review.js';
import { renderSheet, type SheetRow } from './align-sheet.js';
import { parseAlignReference } from './align-review.js';

/**
 * The sheet's behaviour, executed rather than read. Block 8 session 1 checked
 * the markup and never ran the script, so the buttons, the filter, the
 * counters, the localStorage round trip and the download were all unproven on
 * an asset a human is asked to spend an hour inside.
 *
 * happy-dom rather than jsdom: it implements `localStorage` and `Blob` without
 * setup, starts fast enough that Block 8's UI work can run these on every
 * change, and jsdom leaves `URL.createObjectURL` unimplemented, which is the
 * one browser API the download path depends on.
 */
const HEAD = 'ff9d06c706fe2656713da3f0ec26ac1e357f26e5';

const draft = [
  { text: 'Vita', start: 8.2, end: 8.5 },
  { text: 'من', start: 8.9, end: 9.0 },
  { text: 'غير', start: 9.1, end: 9.2 },
];

const rows = buildAlignmentRows(draft, ['Vita', 'mn', 'ghir']);

function mount(html = sheetHtml()): void {
  document.documentElement.innerHTML = html
    .replace(/^[\s\S]*?<body>/, '')
    .replace(/<\/body>[\s\S]*$/, '');

  // happy-dom does not execute a script inserted via innerHTML.
  const source = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (source === undefined) throw new Error('the sheet carries no inline script');
  new Function(source).call(globalThis);
}

function sheetHtml(): string {
  return renderSheet({
    reel: 'vitasilk',
    headSha: HEAD,
    generatedAt: '2026-08-27T00:00:00.000Z',
    cacheEntry: 'transcription-758a3924d090d1b5',
    promptVersion: 4,
    rows,
  });
}

const PREVIOUS_SHA = '0000000000000000000000000000000000000000';

/** The two rows a change moved, with what they used to pair with. */
const rereviewRows: SheetRow[] = [
  { ...(rows[1] as SheetRow), previousDraftText: 'Vita' },
  { ...(rows[2] as SheetRow), previousDraftText: null },
];

function rereviewHtml(): string {
  return renderSheet({
    reel: 'vitasilk',
    headSha: HEAD,
    generatedAt: '2026-08-27T00:00:00.000Z',
    cacheEntry: 'transcription-758a3924d090d1b5',
    promptVersion: 4,
    rows: rereviewRows,
    variant: 'rereview',
    previousSha: PREVIOUS_SHA,
  });
}

const tr = (i: number): HTMLElement =>
  document.querySelector(`tr.row[data-i="${i}"]`) as HTMLElement;
const verdictButton = (i: number, verdict: string): HTMLElement =>
  tr(i).querySelector(`button.v[data-v="${verdict}"]`) as HTMLElement;
const filterButton = (name: string): HTMLElement =>
  document.querySelector(`button.f[data-f="${name}"]`) as HTMLElement;
const count = (id: string): string =>
  (document.getElementById(`c-${id}`) as HTMLElement).textContent ?? '';
const visible = (): number[] =>
  [...document.querySelectorAll('tr.row')]
    .filter((el) => !(el as HTMLElement).hidden)
    .map((el) => Number(el.getAttribute('data-i')));

async function download(): Promise<string> {
  let captured: Blob | null = null;
  const createObjectURL = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation((blob: Blob | MediaSource) => {
      captured = blob as Blob;
      return 'blob:captured';
    });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  // happy-dom navigates on an anchor click otherwise.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  (document.getElementById('download') as HTMLElement).click();
  expect(createObjectURL).toHaveBeenCalledOnce();
  const text = await (captured as unknown as Blob).text();
  vi.restoreAllMocks();
  return text;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.innerHTML = '';
});

describe('the sheet renders what it is built on', () => {
  it('shows the reel, entry, prompt version, aligner sha and row count on screen', () => {
    mount();
    const provenance = document.querySelector('.provenance')?.textContent ?? '';

    expect(provenance).toContain('vitasilk');
    expect(provenance).toContain('transcription-758a3924d090d1b5');
    expect(provenance).toContain('v4');
    expect(provenance).toContain(HEAD.slice(0, 12));
    expect(provenance).toContain(String(rows.length));
  });
});

describe('verdict buttons', () => {
  it('sets exactly one state on the row and updates the counters', () => {
    mount();
    expect(count('unset')).toBe('3');

    verdictButton(1, 'wrong').click();

    expect(tr(1).querySelectorAll('button.v.sel')).toHaveLength(1);
    expect(verdictButton(1, 'wrong').classList.contains('sel')).toBe(true);
    expect(count('wrong')).toBe('1');
    expect(count('unset')).toBe('2');
  });

  it('replaces rather than adds when a second verdict is clicked', () => {
    mount();
    verdictButton(1, 'wrong').click();
    verdictButton(1, 'two-tokens').click();

    expect(tr(1).querySelectorAll('button.v.sel')).toHaveLength(1);
    expect(verdictButton(1, 'two-tokens').classList.contains('sel')).toBe(true);
    expect(count('wrong')).toBe('0');
    expect(count('two-tokens')).toBe('1');
    expect(count('unset')).toBe('2');
  });

  it('clears the verdict when the same button is clicked again', () => {
    mount();
    verdictButton(2, 'correct').click();
    verdictButton(2, 'correct').click();

    expect(tr(2).querySelectorAll('button.v.sel')).toHaveLength(0);
    expect(count('correct')).toBe('0');
    expect(count('unset')).toBe('3');
  });
});

describe('the filter', () => {
  it('shows every row, cross-script rows only, or unset rows only', () => {
    mount();
    expect(visible()).toEqual([0, 1, 2]);

    filterButton('cross').click();
    expect(visible()).toEqual([1, 2]);

    verdictButton(1, 'correct').click();
    filterButton('unset').click();
    expect(visible()).toEqual([0, 2]);

    filterButton('all').click();
    expect(visible()).toEqual([0, 1, 2]);
  });

  it('marks the active filter and only the active filter', () => {
    mount();
    filterButton('cross').click();
    const on = [...document.querySelectorAll('button.f.on')].map((b) => b.getAttribute('data-f'));
    expect(on).toEqual(['cross']);
  });
});

describe('persistence', () => {
  it('restores marks and notes after a reload', () => {
    mount();
    verdictButton(1, 'two-tokens').click();
    const note = tr(2).querySelector('.note input') as HTMLInputElement;
    note.value = 'takes the token before its own';
    note.dispatchEvent(new Event('input'));

    mount();

    expect(verdictButton(1, 'two-tokens').classList.contains('sel')).toBe(true);
    expect((tr(2).querySelector('.note input') as HTMLInputElement).value).toBe(
      'takes the token before its own',
    );
    expect(count('two-tokens')).toBe('1');
    expect(count('unset')).toBe('2');
  });

  it('keys the store by sheet variant, reel and aligner sha, so one does not restore into another', () => {
    mount();
    verdictButton(1, 'wrong').click();

    const keys = Object.keys(window.localStorage);
    expect(keys).toEqual([`framopia.align-review.review.vitasilk.${HEAD}`]);
  });
});

describe('the download', () => {

  it('produces a file that parses against the reference schema', async () => {
    mount();
    verdictButton(1, 'wrong').click();
    verdictButton(2, 'correct').click();

    const reference = parseAlignReference(JSON.parse(await download()));

    expect(reference.schemaVersion).toBe(1);
    expect(reference.reel).toBe('vitasilk');
    expect(reference.headSha).toBe(HEAD);
    expect(reference.generatedAt).toBe('2026-08-27T00:00:00.000Z');
    expect(reference.entries).toEqual([
      { wordId: 'w0001', wordText: 'mn', draftTokenText: 'من', verdict: 'wrong' },
      { wordId: 'w0002', wordText: 'ghir', draftTokenText: 'غير', verdict: 'correct' },
    ]);
  });

  it('carries a note when one was typed, and omits unjudged rows', async () => {
    mount();
    verdictButton(0, 'correct').click();
    const note = tr(0).querySelector('.note input') as HTMLInputElement;
    note.value = 'both Latin, a real match';
    note.dispatchEvent(new Event('input'));

    const reference = parseAlignReference(JSON.parse(await download()));

    expect(reference.entries).toHaveLength(1);
    expect(reference.entries[0]?.note).toBe('both Latin, a real match');
  });

  it('never presents the aligner’s pairing as a verdict', async () => {
    mount();
    const reference = parseAlignReference(JSON.parse(await download()));
    expect(reference.entries).toEqual([]);
  });
});

/**
 * The re-review sheet. Adopting a fix means a human passing over only the rows
 * it moved, so this sheet is on the critical path of every future aligner
 * change and gets the same treatment as the sheet it descends from.
 */
describe('the re-review sheet', () => {
  it('shows the old pairing beside the new one', () => {
    mount(rereviewHtml());

    expect([...document.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      '#',
      'corrected word',
      'was paired with',
      'now paired with',
      'op',
      'interval (s)',
      'scripts',
      'verdict',
      'note',
    ]);
    expect(document.querySelectorAll('tr.row')).toHaveLength(2);
    const was = document.querySelectorAll('td.draft.was');
    expect(was).toHaveLength(2);
    expect(was[0]?.textContent).toBe('Vita');
    expect(was[1]?.textContent).toBe('—');
  });

  it('names itself a re-review and carries the sha it is measured against', () => {
    mount(rereviewHtml());

    expect(document.querySelector('h1')?.textContent).toContain('Re-review');
    const provenance = document.querySelector('.provenance')?.textContent ?? '';
    expect(provenance).toContain('rows moved');
    expect(provenance).toContain(PREVIOUS_SHA.slice(0, 12));
    expect(provenance).toContain(HEAD.slice(0, 12));
  });

  it('carries the same four verdict buttons and counters', () => {
    mount(rereviewHtml());
    expect(count('unset')).toBe('2');

    const row = document.querySelector('tr.row') as HTMLElement;
    const i = Number(row.getAttribute('data-i'));
    (row.querySelector('button.v[data-v="correct"]') as HTMLElement).click();

    expect(row.querySelectorAll('button.v.sel')).toHaveLength(1);
    expect(count('correct')).toBe('1');
    expect(count('unset')).toBe('1');
    expect(i).toBeGreaterThanOrEqual(0);
  });

  /*
   * A partial pass over one sheet must never restore into the other: they hold
   * different rows and ask different questions.
   */
  it('keys its store apart from the review sheet', () => {
    mount(rereviewHtml());
    (document.querySelector('button.v[data-v="wrong"]') as HTMLElement).click();
    const rereviewKeys = Object.keys(window.localStorage);

    mount(sheetHtml());
    expect(count('wrong')).toBe('0');
    (document.querySelector('button.v[data-v="correct"]') as HTMLElement).click();

    expect(rereviewKeys).toEqual([`framopia.align-review.rereview.vitasilk.${HEAD}`]);
    expect(Object.keys(window.localStorage).sort()).toEqual([
      `framopia.align-review.rereview.vitasilk.${HEAD}`,
      `framopia.align-review.review.vitasilk.${HEAD}`,
    ]);
  });

  it('downloads a reference in the same shape', async () => {
    mount(rereviewHtml());
    (document.querySelector('button.v[data-v="correct"]') as HTMLElement).click();

    const reference = parseAlignReference(JSON.parse(await download()));

    expect(reference.schemaVersion).toBe(1);
    expect(reference.reel).toBe('vitasilk');
    expect(reference.headSha).toBe(HEAD);
    expect(reference.entries).toHaveLength(1);
    expect(reference.entries[0]?.verdict).toBe('correct');
  });
});
