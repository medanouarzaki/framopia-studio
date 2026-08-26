import { readFileSync } from 'node:fs';
import { readImageDimensions } from '../images/image-dimensions.js';

/**
 * Dimensions of a generated candidate, read from the bytes. Reuses the Block 4
 * parser rather than adding an image library: it already covers the PNG IHDR
 * and the JPEG frame header, which is every format this pipeline produces, and
 * it fails closed on bytes it cannot measure.
 */
export function imageSize(file: string): { width: number; height: number } {
  const d = readImageDimensions(readFileSync(file));
  if (d === null) throw new Error(`cannot read image dimensions from ${file}`);
  return d;
}
