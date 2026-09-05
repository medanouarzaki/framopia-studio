import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  PALETTE_ROLES,
  CLIENT_LANGUAGES,
  MODES_DIR,
  VIDEO_SHAPES,
  LOCAL_DIR,
  labelWords,
  loadMode,
  modePathFor,
  validateMode,
  type ClientLanguage,
  type ClientMode,
  type ClientPicture,
  type VideoShape,
} from '@framopia/core';

/**
 * Making a client from the panel.
 *
 * A client used to be a file somebody wrote by hand. It is a person the agency
 * works for now — a name, a note that will still mean something in six months,
 * where their footage lives, their fonts and colours, their own pictures — and
 * the panel has to be able to make one.
 *
 * **Everything except the name is optional**, and every absent field takes the
 * value that was in force before the field existed. A client with nothing but a
 * name works exactly as `k2-syndicalia` does.
 *
 * The written file goes through `validateMode` before it reaches disk, so the
 * panel cannot create a client that `npm run validate:modes` would reject.
 */
export class ClientWriteError extends Error {}

export interface NewClient {
  name: string;
  /** One line about them, in his words. Shown under the client picker. */
  about?: string;
  videoFolder?: string;
  /**
   * A client's three faces: a Latin sans for ordinary words, a Latin serif for
   * the emphasised ones, and an Arabic.
   *
   * **`emphasis` was missing until Block 10 session 54.** `createClient` took
   * two, so Dr Loubna Kfafi's third face had to be copied into her file by hand
   * after she was created — session 50 — and any client made through the screen
   * set emphasised words in the ordinary face. It stays optional: a client with
   * two faces is a client who has chosen two, and that is what every build did
   * before the field existed.
   */
  fonts?: { latin: string; arabic: string; emphasis?: string };
  palette?: { background: string; primary: string; accent: string; light: string };
  logoPath?: string;
  /**
   * The client's own photographs. An id is assigned here rather than by the
   * caller, so the setup screen and `addPicture` cannot number them by two
   * different rules.
   */
  pictures?: { path: string; description: string; label?: string }[];
  language?: ClientLanguage;
  subtitleBaselineY?: number;
  videoShape?: VideoShape;
  watermarkByDefault?: boolean;
}

/**
 * The style half a new client starts with, taken from the one client that
 * exists rather than invented: it is the only set of fragments that has ever
 * produced an image, and PROJECT_SPEC §5 forbids inventing a client's identity.
 * He edits it afterwards; what matters is that a new client can run at all.
 */
const TEMPLATE_CLIENT = 'k2-syndicalia';

export function clientIdFor(name: string): string {
  const id = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (id === '') throw new ClientWriteError('that name has no letters or numbers in it');
  return id;
}

export function buildClient(input: NewClient): ClientMode {
  const name = input.name.trim();
  if (name === '') throw new ClientWriteError('a client needs a name');
  const base = loadMode(TEMPLATE_CLIENT);

  /*
   * Named fields, not a spread. Spreading the template carried its `note` — K2
   * Syndicalia's own description — onto every new client, which is exactly the
   * kind of thing nobody would notice until a year later. Only the style half
   * is inherited, because it is the only set of fragments that has ever
   * produced an image; everything about the *client* starts blank.
   */
  const client: ClientMode = {
    id: clientIdFor(name),
    name,
    version: 1,
    palette: base.palette,
    imageStyle: base.imageStyle,
    imageVariation: base.imageVariation,
    allowedTemplates: base.allowedTemplates,
    ...(base.imageScale === undefined ? {} : { imageScale: base.imageScale }),
    ...(base.imageCandidates === undefined ? {} : { imageCandidates: base.imageCandidates }),
    ...(base.imageSlotsPer30s === undefined ? {} : { imageSlotsPer30s: base.imageSlotsPer30s }),
    ...(input.palette === undefined ? {} : { palette: input.palette }),
    fonts: fontsFrom(input.fonts),
    vocabulary: [],
  };
  // Written only when given: an absent field is what makes the default apply,
  // and writing `undefined` would put a null in the file.
  if (input.about !== undefined && input.about.trim() !== '') client.about = input.about.trim();
  if (input.videoFolder !== undefined && input.videoFolder !== '') {
    client.videoFolder = input.videoFolder;
  }
  if (input.logoPath !== undefined && input.logoPath !== '') client.logoPath = input.logoPath;
  if (input.pictures !== undefined && input.pictures.length > 0) {
    const pictures: ClientPicture[] = [];
    for (const picture of input.pictures) {
      checkPicture(picture);
      pictures.push({
        id: nextPictureId(pictures),
        path: picture.path,
        description: picture.description.trim(),
        ...labelField(picture.label),
      });
    }
    client.pictures = pictures;
  }
  if (input.language !== undefined) client.language = input.language;
  if (input.subtitleBaselineY !== undefined) client.subtitleBaselineY = input.subtitleBaselineY;
  if (input.videoShape !== undefined) client.videoShape = input.videoShape;
  if (input.watermarkByDefault !== undefined) {
    client.watermarkByDefault = input.watermarkByDefault;
  }
  return client;
}

export function createClient(input: NewClient): { id: string; modePath: string } {
  const client = buildClient(input);
  const modePath = modePathFor(client.id);
  if (existsSync(modePath)) {
    throw new ClientWriteError(
      `there is already a client called ${client.name}. Pick another name, or edit that one.`,
    );
  }
  const issues = validateMode(client);
  if (issues.length > 0) {
    throw new ClientWriteError(
      `that client would not be valid:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`,
    );
  }
  writeFileSync(modePath, `${JSON.stringify(client, null, 2)}\n`, 'utf8');
  return { id: client.id, modePath };
}

/**
 * What a client's faces become on their file.
 *
 * **The names the screen offers are After Effects' own**, read from
 * `app.fonts.allFonts`, and those are exactly the strings a build has to write:
 * After Effects rejects any font name containing a space, so a family-and-style
 * string like `Inter Semi-Bold` cannot be written to a text layer and the name
 * from the list can. So the chosen name is recorded in both places — as the
 * name a person reads and as the `postScriptNames` entry a build uses — rather
 * than leaving the second unresolved and making a build guess.
 */
function fontsFrom(chosen: NewClient['fonts']): ClientMode['fonts'] {
  if (chosen === undefined) {
    return { status: 'tbd', note: 'Using the standard pair until this client’s own are known.' };
  }
  const emphasis = chosen.emphasis?.trim();
  return {
    status: 'set',
    latin: chosen.latin,
    arabic: chosen.arabic,
    ...(emphasis === undefined || emphasis === '' ? {} : { emphasis }),
    postScriptNames: {
      latin: chosen.latin,
      arabic: chosen.arabic,
      ...(emphasis === undefined || emphasis === '' ? {} : { emphasis }),
    },
    note:
      'Chosen from the faces this After Effects reported. Those names are what it ' +
      'accepts, so they are both what a person reads and what a build writes.',
  };
}

/**
 * A client's own pictures, added or removed one at a time.
 *
 * The file is re-read, edited and written back rather than rebuilt, so nothing
 * a person put in it by hand is lost — the note above all.
 */
export function addPicture(
  modeId: string,
  picture: { path: string; description: string; label?: string },
): ClientPicture {
  const modePath = modePathFor(modeId);
  if (!existsSync(modePath)) throw new ClientWriteError(`there is no client called ${modeId}`);
  checkPicture(picture);
  const raw = JSON.parse(readFileSync(modePath, 'utf8')) as ClientMode;
  const pictures = raw.pictures ?? [];
  const entry: ClientPicture = {
    id: nextPictureId(pictures),
    path: picture.path,
    description: picture.description.trim(),
    ...labelField(picture.label),
  };
  writeMode(modePath, { ...raw, pictures: [...pictures, entry] });
  return entry;
}

/**
 * A label, written only when it says something.
 *
 * **Absent is what makes a picture hand-chosen only**, so an empty box must
 * write nothing rather than an empty string — the validator refuses a label
 * that holds no words, and it is right to: a field somebody meant to fill and
 * left blank is not the same as a field they deliberately left alone.
 */
function labelField(label: string | undefined): { label?: string } {
  if (label === undefined) return {};
  const trimmed = label.trim();
  if (trimmed === '' || labelWords(trimmed).length === 0) return {};
  return { label: trimmed };
}

/**
 * The label on a picture a client already has, changed or cleared.
 *
 * On the `setPalette` precedent: re-read, edit, write back, so a note anyone
 * typed into the file by hand survives. **It does not bump the version.** A
 * label decides which picture answers a word the next time slots are planned;
 * it is not part of the look a reel pins, and offering to move every reel
 * forward because a label was corrected would be noise.
 */
export function setPictureLabel(
  modeId: string,
  pictureId: string,
  label: string,
): ClientPicture {
  const modePath = modePathFor(modeId);
  if (!existsSync(modePath)) throw new ClientWriteError(`there is no client called ${modeId}`);
  const raw = JSON.parse(readFileSync(modePath, 'utf8')) as ClientMode;
  const pictures = raw.pictures ?? [];
  const found = pictures.find((p) => p.id === pictureId);
  if (found === undefined) {
    throw new ClientWriteError(`${modeId} has no picture called ${pictureId}`);
  }
  const next: ClientPicture = { id: found.id, path: found.path, description: found.description };
  const written = labelField(label);
  if (written.label !== undefined) next.label = written.label;
  writeMode(modePath, {
    ...raw,
    pictures: pictures.map((p) => (p.id === pictureId ? next : p)),
  });
  return next;
}

/**
 * A saved client's four brand colours, corrected.
 *
 * **Why this exists.** Until Block 10 session 45 a palette could only be set
 * when the client was created, and — because `save()` never sent it — could not
 * really be set even then. A client saved with the wrong colours could not be
 * put right at all. Block 10 session 40 found the missing route, 44 found the
 * missing send, and this closes both.
 *
 * Re-read, edited and written back like the picture routes above it, so a note
 * or a font someone typed into the file by hand survives the edit. The whole
 * palette is replaced rather than one role: the four are one object on the mode,
 * `renderStylePrompt` substitutes every one of them into an image prompt, and a
 * half-written palette would reach the model as the word "undefined".
 *
 * **It bumps the client's version, and that is the point.** Every reel pins a
 * snapshot of the client at the moment it was analysed and rebuilds from that
 * snapshot forever, so a reel already made keeps the look it was made with.
 * `snapshotIsBehind` is what then tells the panel a reel could be moved forward,
 * and moving it is a control someone presses.
 */
export function setPalette(modeId: string, palette: Record<string, string>): ClientMode {
  const modePath = modePathFor(modeId);
  if (!existsSync(modePath)) throw new ClientWriteError(`there is no client called ${modeId}`);
  const missing = PALETTE_ROLES.filter((role) => typeof palette[role] !== 'string');
  if (missing.length > 0) {
    throw new ClientWriteError(
      `a palette needs all four colours; ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing`,
    );
  }
  const raw = JSON.parse(readFileSync(modePath, 'utf8')) as ClientMode;
  const next = {
    ...raw,
    version: raw.version + 1,
    palette: Object.fromEntries(
      PALETTE_ROLES.map((role) => [role, (palette[role] as string).toUpperCase()]),
    ) as ClientMode['palette'],
  };
  writeMode(modePath, next);
  return next;
}

export function removePicture(modeId: string, pictureId: string): void {
  const modePath = modePathFor(modeId);
  if (!existsSync(modePath)) throw new ClientWriteError(`there is no client called ${modeId}`);
  const raw = JSON.parse(readFileSync(modePath, 'utf8')) as ClientMode;
  const pictures = (raw.pictures ?? []).filter((p) => p.id !== pictureId);
  const next = { ...raw };
  if (pictures.length === 0) delete next.pictures;
  else next.pictures = pictures;
  writeMode(modePath, next);
}

/**
 * The same three refusals whether the photograph arrives with a new client or
 * is added to a saved one. A setup screen that accepted what the client card
 * refuses would write a client file the panel could not have made twice.
 */
function checkPicture(picture: { path: string; description: string }): void {
  if (!path.isAbsolute(picture.path)) {
    throw new ClientWriteError('a picture needs the full path to the file');
  }
  if (!existsSync(picture.path)) {
    throw new ClientWriteError(`there is no file at ${picture.path}`);
  }
  if (picture.description.trim() === '') {
    throw new ClientWriteError('describe the picture, so you can tell it from the others later');
  }
}

function nextPictureId(pictures: ClientPicture[]): string {
  let n = pictures.length + 1;
  const taken = new Set(pictures.map((p) => p.id));
  while (taken.has(`pic${String(n).padStart(3, '0')}`)) n += 1;
  return `pic${String(n).padStart(3, '0')}`;
}

function writeMode(modePath: string, client: ClientMode): void {
  const issues = validateMode(client);
  if (issues.length > 0) {
    throw new ClientWriteError(
      `that change would break the client file:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`,
    );
  }
  writeFileSync(modePath, `${JSON.stringify(client, null, 2)}\n`, 'utf8');
}

/**
 * Everything about a client except their colours and their photographs.
 *
 * **Until this, only the palette could be corrected.** A name typed wrong, a
 * folder that moved, a face chosen before the client had one — all of it was
 * fixed for the life of the client, and session 43 found four settings the
 * screen collected that reached nothing at all. On the `setPalette` precedent:
 * re-read, edit the fields that were sent, write back, so a note anyone typed
 * into the file by hand survives.
 *
 * **Only a field that is sent is touched**, and `null` is how the screen says
 * *clear this*. An absent key means leave it exactly as it is, which is what
 * lets one control edit one thing.
 *
 * **The version moves only when the look does.** A reel pins a snapshot of the
 * client and rebuilds from it forever, so `snapshotIsBehind` is what offers to
 * move a reel forward — and offering that because somebody fixed a typo in the
 * folder path would be noise. The snapshot carries the name, the faces and the
 * subtitle baseline; the rest is about the client, not about a comp.
 *
 * **The id never changes.** It is the filename, the value on every plan and the
 * key every reel's snapshot pins. Renaming the client renames what a person
 * reads, and nothing else.
 */
export interface ClientDetails {
  name?: string;
  about?: string | null;
  videoFolder?: string | null;
  logoPath?: string | null;
  language?: ClientLanguage | null;
  subtitleBaselineY?: number | null;
  videoShape?: VideoShape | null;
  watermarkByDefault?: boolean | null;
  fonts?: { latin: string; arabic: string; emphasis?: string } | null;
}

/** The fields a reel's pinned snapshot carries, and so the ones that move it. */
const IN_THE_SNAPSHOT: readonly (keyof ClientDetails)[] = ['name', 'fonts', 'subtitleBaselineY'];

export function setDetails(modeId: string, details: ClientDetails): ClientMode {
  const modePath = modePathFor(modeId);
  if (!existsSync(modePath)) throw new ClientWriteError(`there is no client called ${modeId}`);
  const raw = JSON.parse(readFileSync(modePath, 'utf8')) as ClientMode;
  const next: ClientMode = { ...raw };

  const given = (key: keyof ClientDetails): boolean =>
    Object.prototype.hasOwnProperty.call(details, key);

  if (given('name')) {
    const name = String(details.name ?? '').trim();
    if (name === '') throw new ClientWriteError('a client needs a name');
    next.name = name;
  }
  if (given('about')) setOrClear(next, 'about', textOrNull(details.about));
  if (given('videoFolder')) setOrClear(next, 'videoFolder', textOrNull(details.videoFolder));
  if (given('logoPath')) setOrClear(next, 'logoPath', textOrNull(details.logoPath));
  if (given('language')) {
    const language = details.language ?? null;
    if (language !== null && !CLIENT_LANGUAGES.includes(language)) {
      throw new ClientWriteError(`${language} is not a language this tool knows`);
    }
    setOrClear(next, 'language', language);
  }
  if (given('videoShape')) {
    const shape = details.videoShape ?? null;
    if (shape !== null && !VIDEO_SHAPES.includes(shape)) {
      throw new ClientWriteError(`${shape} is not a video shape this tool knows`);
    }
    setOrClear(next, 'videoShape', shape);
  }
  if (given('subtitleBaselineY')) {
    const baseline = details.subtitleBaselineY ?? null;
    if (baseline !== null && (!Number.isFinite(baseline) || baseline <= 0)) {
      throw new ClientWriteError('the subtitle baseline is a number of pixels from the top');
    }
    setOrClear(next, 'subtitleBaselineY', baseline);
  }
  if (given('watermarkByDefault')) {
    setOrClear(next, 'watermarkByDefault', details.watermarkByDefault ?? null);
  }
  if (given('fonts')) {
    next.fonts =
      details.fonts === null
        ? { status: 'tbd', note: 'Waiting for this client’s own faces to be chosen.' }
        : fontsFrom(details.fonts);
  }

  const looksDifferent = IN_THE_SNAPSHOT.some(
    (key) => given(key) && JSON.stringify(readField(raw, key)) !== JSON.stringify(readField(next, key)),
  );
  if (looksDifferent) next.version = raw.version + 1;

  writeMode(modePath, next);
  return next;
}

function readField(mode: ClientMode, key: keyof ClientDetails): unknown {
  return (mode as unknown as Record<string, unknown>)[key];
}

function textOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function setOrClear<K extends keyof ClientMode>(
  mode: ClientMode,
  key: K,
  value: ClientMode[K] | null,
): void {
  if (value === null) delete mode[key];
  else mode[key] = value;
}

/** Where a deleted client's file goes. */
export const DELETED_CLIENTS_DIR = path.join(LOCAL_DIR, 'deleted-clients');

export interface DeletedClient {
  id: string;
  name: string;
  /** Where the file went. It is not destroyed. */
  movedTo: string;
}

/**
 * A client, taken off the picker.
 *
 * **The file is moved aside, not destroyed.** A client is something the user
 * made — their name, their colours, their faces, the photographs they chose —
 * and this project does not delete what a person made; it goes to
 * `.local/deleted-clients/` with the moment it went, and the reply says where.
 * From the panel's point of view the client is gone, which is what was asked
 * for.
 *
 * **A reel already built keeps the look it was built with.** Every reel pins a
 * snapshot of the client at the moment it was analysed and rebuilds from that,
 * and `resolveClientIdentity` already treats a missing client file as *nothing
 * to compare against* rather than an error. What a deleted client does break is
 * a reel that uses one of **their own photographs**: the picture is named by an
 * id on this client, and with the client gone there is nothing to resolve it
 * against. The confirmation says both.
 */
export function deleteClient(modeId: string): DeletedClient {
  const modePath = modePathFor(modeId);
  if (!existsSync(modePath)) throw new ClientWriteError(`there is no client called ${modeId}`);
  const raw = JSON.parse(readFileSync(modePath, 'utf8')) as ClientMode;
  mkdirSync(DELETED_CLIENTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const movedTo = path.join(DELETED_CLIENTS_DIR, `${modeId}-${stamp}.json`);
  renameSync(modePath, movedTo);
  return { id: modeId, name: raw.name, movedTo };
}

export { CLIENT_LANGUAGES, MODES_DIR, VIDEO_SHAPES };
