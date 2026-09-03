import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';

/**
 * **Every field the New Client screen collects is read by something, and the
 * screen says which of them change a build.**
 *
 * The defect class, not its four instances. Block 10 session 43 ran eight new
 * videos through the product and found that four of the eleven things the
 * screen collects — the watermark, the subtitle baseline, the video shape and
 * the language — were written, validated, and echoed back to the user as
 * settings of theirs, while nothing between there and the build read any of
 * them. One of them put a mark on the delivered video of a client who had
 * switched it off.
 *
 * A grep cannot tell "read" from "read by something that matters", so this does
 * not try to. What it pins is the **inventory**: every field the panel sends is
 * listed here with what it is for, and a field added to the screen without
 * being added here fails. Deciding which column a new field belongs in is then
 * a person's judgement at the moment it is added, which is the only moment
 * anyone has the context to make it.
 */
const PANEL = path.join(REPO_ROOT, 'panel', 'src', 'NewClient.tsx');

/** What the panel sends, and what the project says each one does. */
const FIELDS: Record<string, 'builds a reel' | 'runs the tool' | 'shown to the user' | 'recorded only'> = {
  name: 'builds a reel',
  fonts: 'builds a reel',
  watermarkByDefault: 'builds a reel',
  subtitleBaselineY: 'builds a reel',
  pictures: 'builds a reel',
  videoFolder: 'runs the tool',
  about: 'shown to the user',
  logoPath: 'shown to the user',
  // Read by nothing that builds a reel, and the client card says so rather
  // than claiming otherwise. `videoShape` is worse than unused: Browse refuses
  // anything but 2160x3840, so a client set to "wide" is contradicted by the
  // product. `language` would have to fork a guide that is global and
  // versioned, in a stage that deliberately runs before a client is chosen.
  videoShape: 'recorded only',
  language: 'recorded only',
};

/**
 * **Collected on the screen and never sent.** The four colour swatches are the
 * whole of a client's brand — they style every card and they are the only thing
 * that reaches the image model about a client's look — and the save function
 * never puts them in the body. `createClient` then falls back to
 * `k2-syndicalia`'s palette, so a user who picks four colours gets K2's four.
 *
 * Found by this test at Block 10 session 44 and left standing on purpose: the
 * session was authorised to fix the four fields session 43 measured, and this
 * is a fifth. Pinned here so it cannot drift quietly, and so that fixing it
 * means deleting this entry rather than editing an assertion.
 */
const COLLECTED_BUT_NEVER_SENT = ['palette'];

/** Every `body['x'] = …` the save function writes, which is what reaches the service. */
function fieldsThePanelSends(): string[] {
  const text = readFileSync(PANEL, 'utf8');
  const found = new Set<string>();
  for (const m of text.matchAll(/body\['([a-zA-Z]+)'\]\s*=/g)) found.add(m[1] as string);
  // `name` is set in the object literal the others are added to.
  found.add('name');
  return [...found].sort();
}

describe('every client field is accounted for', () => {
  it('sends nothing the inventory does not name', () => {
    const unaccounted = fieldsThePanelSends().filter((f) => FIELDS[f] === undefined);
    expect(
      unaccounted,
      'a field the New Client screen collects that nobody has decided the meaning of',
    ).toEqual([]);
  });

  it('names nothing the screen no longer sends', () => {
    const sent = new Set(fieldsThePanelSends());
    expect(Object.keys(FIELDS).filter((f) => !sent.has(f))).toEqual([]);
  });

  it('still fails to send exactly the fields known not to be sent', () => {
    const sent = new Set(fieldsThePanelSends());
    expect(
      COLLECTED_BUT_NEVER_SENT.filter((f) => sent.has(f)),
      'a field listed as never sent is now sent — move it into FIELDS',
    ).toEqual([]);
    // And the screen still collects it, or the entry is stale.
    const text = readFileSync(PANEL, 'utf8');
    for (const f of COLLECTED_BUT_NEVER_SENT) {
      expect(new RegExp(`\\b${f}\\b`).test(text), `${f} is no longer on the screen`).toBe(true);
    }
  });

  /**
   * The half a grep can check: a field said to build a reel has to be read
   * somewhere outside the three files that only store, validate and display it.
   */
  it('reads every field that claims to build a reel', () => {
    const stores = new Set([
      path.join('service', 'src', 'clients', 'create.ts'),
      path.join('core', 'src', 'mode.ts'),
      path.join('core', 'src', 'client-defaults.ts'),
      path.join('service', 'src', 'catalogue.ts'),
    ]);
    const sources: { file: string; text: string }[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (!['node_modules', 'dist', '.venv'].includes(e.name)) walk(p);
        } else if (/\.tsx?$/.test(e.name) && !e.name.includes('.test.')) {
          sources.push({ file: path.relative(REPO_ROOT, p), text: readFileSync(p, 'utf8') });
        }
      }
    };
    walk(path.join(REPO_ROOT, 'service', 'src'));
    walk(path.join(REPO_ROOT, 'core', 'src'));

    const unread: string[] = [];
    for (const [field, kind] of Object.entries(FIELDS)) {
      if (kind !== 'builds a reel' || field === 'name') continue;
      const readers = sources.filter(
        (s) => !stores.has(s.file) && new RegExp(`\\b${field}\\b`).test(s.text),
      );
      if (readers.length === 0) unread.push(field);
    }
    expect(unread, 'a field the inventory says builds a reel that nothing outside its own storage reads').toEqual([]);
  });
});
