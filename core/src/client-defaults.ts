import { ARABIC_FONT, LATIN_FONT, SUBTITLE_ANCHOR_BASELINE_Y } from './typography.js';
import type { ClientLanguage, ClientMode, VideoShape } from './mode.js';

/**
 * What a client that says nothing gets.
 *
 * Every client detail is optional, so every one of them needs an answer for the
 * client who leaves it blank — and the answer has to be **what the tool already
 * did**, or adding a field would change what an existing client builds. Each
 * default below is the value in force before the field existed, which is why
 * `k2-syndicalia` builds `vitasilk` identically after this change.
 */
export interface ClientDefaults {
  language: ClientLanguage;
  videoShape: VideoShape;
  watermark: boolean;
  subtitleBaselineY: number;
  /** Where the value came from, so the panel can say "the standard one". */
  source: Record<'language' | 'videoShape' | 'watermark' | 'subtitleBaselineY', 'client' | 'standard'>;
}

export function clientDefaults(mode: Pick<ClientMode,
  'language' | 'videoShape' | 'watermarkByDefault' | 'subtitleBaselineY'>): ClientDefaults {
  return {
    language: mode.language ?? 'mixed',
    videoShape: mode.videoShape ?? 'vertical',
    watermark: mode.watermarkByDefault ?? true,
    subtitleBaselineY: mode.subtitleBaselineY ?? SUBTITLE_ANCHOR_BASELINE_Y,
    source: {
      language: mode.language === undefined ? 'standard' : 'client',
      videoShape: mode.videoShape === undefined ? 'standard' : 'client',
      watermark: mode.watermarkByDefault === undefined ? 'standard' : 'client',
      subtitleBaselineY: mode.subtitleBaselineY === undefined ? 'standard' : 'client',
    },
  };
}

/** The two faces a client with no fonts of their own gets, named for the panel. */
export const STANDARD_FONTS = { latin: LATIN_FONT, arabic: ARABIC_FONT };
