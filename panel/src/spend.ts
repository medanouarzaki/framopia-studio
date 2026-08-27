/**
 * ARCHITECTURE §6's soft alarm. Chosen there, not here: PROJECT_SPEC §5 puts a
 * finished reel at $0.50–2.00, so $2.00 is the top of the expected envelope
 * rather than a hard ceiling — the image stage has its own refusal.
 *
 * "Wired but not triggerable" is literal: no reel on this machine is near it
 * (`vitasilk` is the highest at $1.550444), and nothing in the panel can spend
 * yet. It is here so the first run that approaches it is not the run that
 * discovers the alarm was never built.
 */
export const SPEND_SOFT_ALARM_USD = 2;

export type SpendLevel = 'none' | 'normal' | 'alarm';

export function spendLevel(spentUsd: number | null): SpendLevel {
  if (spentUsd === null) return 'none';
  return spentUsd >= SPEND_SOFT_ALARM_USD ? 'alarm' : 'normal';
}

export function formatUsd(spentUsd: number | null): string {
  return spentUsd === null ? 'not run yet' : `$${spentUsd.toFixed(4)}`;
}
