import type { TemplateEntry } from '@framopia/core';
import type { EditPlan } from '../editplan/types.js';
import { cardMinimumDurationS } from '../build/short-card.js';
import {
  displayWindow,
  DURATION_EPSILON_S,
  findShortWords,
  type ShortWord,
} from './display-timing.js';

export interface BuildabilityIssue {
  path: string;
  message: string;
  /** Present on a duration failure: how many seconds short the element is. */
  shortByS?: number;
}

export interface BuildabilityReport {
  issues: BuildabilityIssue[];
  checked: { subtitleGroups: number; keywords: number; imageSlots: number; sfxEvents: number };
  /**
   * Words too short to be real timings. Reported, never repaired, and never
   * counted as a buildability failure: they are a Block 2 alignment question
   * and fixing them here would invent a measurement.
   */
  shortWords: ShortWord[];
}

/**
 * The checks that stop Block 7 discovering an unbuildable plan with After
 * Effects already open. Pure, and it reports every failure rather than
 * stopping at the first: a plan is fixed once, not once per run.
 *
 * Nothing here repairs anything. Session 4 produced an image slot 1.28 s long
 * against a template needing more than that in intro, hold and outro alone;
 * silently stretching it would move the image off the sentence it
 * illustrates.
 */
export function checkBuildability(
  plan: EditPlan,
  templates: Map<string, TemplateEntry>,
): BuildabilityReport {
  const issues: BuildabilityIssue[] = [];

  const durationCheck = (
    path: string,
    start: number,
    end: number,
    templateId: string | null,
  ): void => {
    if (templateId === null) {
      issues.push({ path, message: 'no templateId assigned' });
      return;
    }
    const template = templates.get(templateId);
    if (template === undefined) {
      issues.push({ path, message: `templateId ${templateId} is not in the manifest` });
      return;
    }
    /*
     * The floor a card has to clear once the entrance may compress. Read from
     * `short-card.ts`, which is the rule's single declaration — restating the
     * arithmetic here is how this tool came to report 120 cards unbuildable
     * while the builder was placing all 343.
     */
    const needed = cardMinimumDurationS(template.introS, template.minHoldS) + template.outroS;
    const have = end - start;
    if (have < needed - DURATION_EPSILON_S) {
      issues.push({
        path,
        message:
          `${have.toFixed(2)}s long but ${templateId} needs ${needed.toFixed(2)}s ` +
          `(intro ${template.introS} + hold ${template.minHoldS} + outro ${template.outroS})`,
        shortByS: needed - have,
      });
    }
  };

  // A subtitle is judged on how long its card is up, not on how long the word
  // took to say. The two are the same until display timing has run.
  plan.subtitles.groups.forEach((g, i) => {
    const window = displayWindow(g);
    durationCheck(`subtitles.groups[${i}]`, window.start, window.end, g.templateId);
  });
  plan.keywords.items.forEach((k, i) => {
    durationCheck(`keywords.items[${i}]`, k.start, k.end, k.templateId);
  });
  plan.images.slots.forEach((s, i) => {
    durationCheck(`images.slots[${i}]`, s.start, s.end, s.templateId);
  });

  /*
   * A keyword span covers a run of consecutive subtitle cards and supersedes
   * every one of them. It used to have to be exactly one card, which held while
   * cards were 1-2 words and a span could always be collapsed into one; at one
   * word per card (Block 7 session 6) a two-word span covers two cards and both
   * are marked. What still has to hold is that the span's words and the
   * superseded cards' words are the same set, in the same order.
   */
  const wordToGroup = new Map<string, (typeof plan.subtitles.groups)[number]>();
  for (const g of plan.subtitles.groups) for (const id of g.wordIds) wordToGroup.set(id, g);
  plan.keywords.items.forEach((k, i) => {
    const covering = k.wordIds.map((id) => wordToGroup.get(id));
    if (covering.some((g) => g === undefined)) {
      issues.push({
        path: `keywords.items[${i}]`,
        message: 'span names a word that is in no subtitle group',
      });
      return;
    }
    const groups = covering as NonNullable<(typeof covering)[number]>[];
    const unique = [...new Set(groups.map((g) => g.id))];
    const covered = groups.flatMap((g) => g.wordIds);
    if ([...new Set(covered)].length !== k.wordIds.length) {
      issues.push({
        path: `keywords.items[${i}]`,
        message:
          `span covers group(s) ${unique.join(', ')}, which hold words the span does not`,
      });
      return;
    }
    const notMarked = groups.filter((g) => g.supersededBy !== k.id).map((g) => g.id);
    if (notMarked.length > 0) {
      issues.push({
        path: `keywords.items[${i}]`,
        message: `group(s) ${[...new Set(notMarked)].join(', ')} are covered by the span but not marked superseded by ${k.id}`,
      });
    }
  });

  const wordIds = new Set(plan.transcript.words.map((w) => w.id));
  let previousEnd: number | null = null;
  plan.images.slots.forEach((slot, i) => {
    for (const id of slot.wordIds) {
      if (!wordIds.has(id)) {
        issues.push({
          path: `images.slots[${i}].wordIds`,
          message: `no transcript word has id ${id}`,
        });
      }
    }
    if (previousEnd !== null && slot.start < previousEnd) {
      issues.push({
        path: `images.slots[${i}]`,
        message: `overlaps the previous slot, which ends at ${previousEnd.toFixed(2)}s`,
      });
    }
    previousEnd = slot.end;
  });

  for (const event of plan.sfx.events) {
    if (!Number.isFinite(event.timeS) || event.timeS < 0) {
      issues.push({ path: 'sfx.events', message: `${event.id} fires at ${event.timeS}s` });
    }
  }

  return {
    issues,
    shortWords: findShortWords(plan.transcript.words),
    checked: {
      subtitleGroups: plan.subtitles.groups.length,
      keywords: plan.keywords.items.length,
      imageSlots: plan.images.slots.length,
      sfxEvents: plan.sfx.events.length,
    },
  };
}
