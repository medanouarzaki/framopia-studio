import { clientPictureById, loadMode, type ClientMode } from '@framopia/core';
import type { EditPlan, ImageSlot } from '../editplan/types.js';

export class ClientPictureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientPictureError';
  }
}

/**
 * The file behind a slot one of the client's own pictures fills, or null when
 * none does.
 *
 * **One declaration, because there is more than one caller.** The build CLI
 * resolves it to place the picture and again at pre-flight to check the file is
 * there, and `buildReel` is handed the same answer through `candidateFileFor`.
 * Session 4 lost four of five images to two copies of one rule disagreeing, and
 * this is the same shape.
 *
 * **A picture id is only meaningful inside its own client.** Every client
 * numbers its pictures `pic001` upward, so `pic001` names a different
 * photograph on every client there is. The owner is the client on the plan,
 * never the `--mode` override: the look of a reel may be rebuilt as somebody
 * else's, but whose photograph it is may not. That is the collision sessions 50
 * to 52 closed in four other places.
 */
export function clientPictureFileFor(
  plan: Pick<EditPlan, 'clientMode'>,
  slot: Pick<ImageSlot, 'id' | 'chosenClientPictureId'>,
  options: { overrideModeId?: string; load?: (id: string) => Pick<ClientMode, 'pictures'> } = {},
): { path: string; id: string } | null {
  const pictureId = slot.chosenClientPictureId;
  if (pictureId === undefined) return null;

  const owner = plan.clientMode?.id;
  if (owner === undefined) {
    throw new ClientPictureError(
      `${slot.id}: this plan names the picture ${pictureId} but names no client, ` +
        'so there is no way to know whose photograph it is',
    );
  }
  const override = options.overrideModeId;
  if (override !== undefined && override !== owner) {
    throw new ClientPictureError(
      `${slot.id}: this reel was made for ${owner} and names that client's picture ` +
        `${pictureId}. Building it as ${override} would show a different client’s ` +
        'photograph, so it is refused.',
    );
  }

  const load = options.load ?? loadMode;
  const picture = clientPictureById(load(owner), pictureId);
  if (picture === null) {
    throw new ClientPictureError(
      `${slot.id}: the client picture ${pictureId} is not on ${owner} any more`,
    );
  }
  return { path: picture.path, id: picture.id };
}
