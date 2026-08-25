/**
 * Minimal header readers for the two formats these models return. No decoder
 * dependency: we need width and height, not pixels, and both formats put them
 * in a fixed place near the front of the file.
 *
 * This exists because Block 4 session 2 shipped a 2752x1536 image as a 2K 1:1
 * candidate. Nothing in the code could see the dimensions — they were measured
 * afterwards with `sips` — so a human had to notice.
 */
export interface Dimensions {
  width: number;
  height: number;
}

/** PNG: an 8-byte signature, then an IHDR chunk whose first 8 bytes are w/h. */
function readPngDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((b, i) => bytes[i] === b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// Frame markers carrying height/width. SOF0/1/2/3, 5-7, 9-11, 13-15. DHT
// (0xC4), JPG (0xC8) and DAC (0xCC) share the 0xCn range and are not frames.
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** JPEG: walk the segment chain to the first start-of-frame marker. */
function readJpegDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] as number;
    // Padding between segments, and standalone markers carrying no length.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    if (offset + 3 >= bytes.length) return null;
    const length = view.getUint16(offset + 2);
    if (SOF_MARKERS.has(marker)) {
      if (offset + 9 >= bytes.length) return null;
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

/**
 * Null when the bytes are not a format we can read, which a caller must treat
 * as "unknown", never as "correct". Guessing a dimension here would recreate
 * the defect this module exists for.
 */
export function readImageDimensions(bytes: Uint8Array, mimeType?: string): Dimensions | null {
  if (mimeType === 'image/png') return readPngDimensions(bytes);
  if (mimeType === 'image/jpeg') return readJpegDimensions(bytes);
  return readPngDimensions(bytes) ?? readJpegDimensions(bytes);
}

/**
 * Raised when the expected pixel dimensions for a (size, aspect) pair cannot
 * be derived. **Not a null return**: `generateImages` reads null as "no
 * expectation" and skips the dimension check entirely, so returning null for
 * an unknown pair would silently disable the check the moment a non-square
 * ratio were allowed.
 *
 * That is the `findProclitics` defect again — guide §2 claimed the scorer
 * flagged a standalone `w` while the scorer only suppressed a warning for it,
 * and nothing detected the gap for a whole version. A guard that quietly
 * declines to guard is worse than no guard, because it reads as one.
 */
export class UndeterminedDimensionsError extends Error {
  constructor(
    readonly resolution: string,
    readonly aspectRatio: string,
    reason: string,
  ) {
    super(
      `cannot determine expected dimensions for ${resolution} at ${aspectRatio}: ${reason}. ` +
        'The dimension check cannot be skipped: add the pair to expectedDimensions first.',
    );
    this.name = 'UndeterminedDimensionsError';
  }
}

/** The pixel dimensions a (size, aspect) pair is supposed to produce. */
export function expectedDimensions(resolution: string, aspectRatio: string): Dimensions {
  const side = { '0.5K': 512, '1K': 1024, '2K': 2048, '4K': 4096 }[resolution];
  if (side === undefined) {
    throw new UndeterminedDimensionsError(resolution, aspectRatio, 'unknown resolution tier');
  }
  const parts = aspectRatio.split(':').map(Number);
  const [w, h] = parts;
  if (parts.length !== 2 || w === undefined || h === undefined || !(w > 0) || !(h > 0)) {
    throw new UndeterminedDimensionsError(resolution, aspectRatio, 'unreadable aspect ratio');
  }
  if (w === h) return { width: side, height: side };
  // Session 2 showed the served token count for a non-published pair is not
  // derivable from area, and the pixel dimensions are not derivable from the
  // square side either. Config allows only 1:1 today; whoever allows another
  // ratio has to state what it produces here.
  throw new UndeterminedDimensionsError(
    resolution, aspectRatio,
    'only square ratios have known dimensions; a non-square tier is not derivable from the square side',
  );
}
