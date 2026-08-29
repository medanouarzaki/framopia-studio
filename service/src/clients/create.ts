import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CLIENT_LANGUAGES,
  MODES_DIR,
  VIDEO_SHAPES,
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
  fonts?: { latin: string; arabic: string };
  palette?: { background: string; primary: string; accent: string; light: string };
  logoPath?: string;
  pictures?: ClientPicture[];
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
    fonts:
      input.fonts === undefined
        ? { status: 'tbd', note: 'Using the standard pair until this client’s own are known.' }
        : { status: 'set', latin: input.fonts.latin, arabic: input.fonts.arabic },
    vocabulary: [],
  };
  // Written only when given: an absent field is what makes the default apply,
  // and writing `undefined` would put a null in the file.
  if (input.about !== undefined && input.about.trim() !== '') client.about = input.about.trim();
  if (input.videoFolder !== undefined && input.videoFolder !== '') {
    client.videoFolder = input.videoFolder;
  }
  if (input.logoPath !== undefined && input.logoPath !== '') client.logoPath = input.logoPath;
  if (input.pictures !== undefined && input.pictures.length > 0) client.pictures = input.pictures;
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
 * A client's own pictures, added or removed one at a time.
 *
 * The file is re-read, edited and written back rather than rebuilt, so nothing
 * a person put in it by hand is lost — the note above all.
 */
export function addPicture(
  modeId: string,
  picture: { path: string; description: string },
): ClientPicture {
  const modePath = modePathFor(modeId);
  if (!existsSync(modePath)) throw new ClientWriteError(`there is no client called ${modeId}`);
  if (!path.isAbsolute(picture.path)) {
    throw new ClientWriteError('a picture needs the full path to the file');
  }
  if (!existsSync(picture.path)) {
    throw new ClientWriteError(`there is no file at ${picture.path}`);
  }
  if (picture.description.trim() === '') {
    throw new ClientWriteError('describe the picture, so you can tell it from the others later');
  }
  const raw = JSON.parse(readFileSync(modePath, 'utf8')) as ClientMode;
  const pictures = raw.pictures ?? [];
  const entry: ClientPicture = {
    id: nextPictureId(pictures),
    path: picture.path,
    description: picture.description.trim(),
  };
  writeMode(modePath, { ...raw, pictures: [...pictures, entry] });
  return entry;
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

export { CLIENT_LANGUAGES, MODES_DIR, VIDEO_SHAPES };
