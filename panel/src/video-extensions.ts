/**
 * What the file dialog offers, without the dots CEP does not want.
 *
 * Mirrored from `service/src/clients/videos.ts`, which is what decides whether
 * a file is offered in a client's folder; a test pins the two together, because
 * a dialog that lets him choose a file the list would refuse is a dialog that
 * hands him an error.
 */
export const VIDEO_EXTENSIONS_WITHOUT_DOT = ['mov', 'mp4', 'm4v', 'avi', 'mkv'] as const;
