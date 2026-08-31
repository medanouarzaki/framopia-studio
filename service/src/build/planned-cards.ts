import type { EditPlan, SubtitleGroup } from '../editplan/types.js';

/**
 * Which groups and keywords actually become cards.
 *
 * **The panel promised five cards more than the build delivered.** Its
 * pre-build summary read `73 subtitle cards` for `vitasilk` against a comp
 * carrying 68, because it took `checkBuildability`'s `subtitleGroups`, which is
 * `plan.subtitles.groups.length` — every group, including the five a keyword
 * supersedes. That is the right number for validating a plan and the wrong one
 * for telling someone what they are about to get.
 *
 * So the rule lives here once and `buildReel` uses it, rather than the preview
 * carrying a second implementation that agrees until it does not. A group is a
 * card unless a keyword replaced it, it carries no template, or it has no
 * display timing — the three reasons `buildReel` skips one.
 */
export interface PlannedCards {
  /** Groups that become a subtitle card. */
  subtitleCards: number;
  /** Keywords that become a card of their own. */
  keywordCards: number;
  /** Groups a keyword replaced; they are drawn by the keyword instead. */
  superseded: number;
  /** Groups the build would skip and say so: no template, or no display timing. */
  unbuildable: number;
}

export function isSuperseded(group: SubtitleGroup): boolean {
  return group.supersededBy != null;
}

/** The two conditions `buildReel` skips a non-superseded group for. */
export function isBuildableGroup(group: SubtitleGroup): boolean {
  if (group.templateId === null) return false;
  return group.displayStart !== undefined && group.displayEnd !== undefined;
}

export function plannedCards(plan: EditPlan): PlannedCards {
  const groups = plan.subtitles.groups;
  const superseded = groups.filter(isSuperseded);
  const rest = groups.filter((g) => !isSuperseded(g));
  const buildable = rest.filter(isBuildableGroup);
  return {
    subtitleCards: buildable.length,
    keywordCards: plan.keywords.items.filter((k) => k.templateId !== null).length,
    superseded: superseded.length,
    unbuildable: rest.length - buildable.length,
  };
}
