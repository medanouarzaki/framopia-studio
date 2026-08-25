import { describe, expect, it } from 'vitest';
import type { ClientMode } from '@framopia/core';
import {
  buildKeywordPrompt,
  candidateCountFor,
  parseKeywordResponse,
  MIN_CANDIDATES,
} from './keywords.js';
import { AnalysisError, type AnalysisWord } from './types.js';

const words: AnalysisWord[] = [
  { id: 'w0', text: 'bghiti', start: 0, end: 0.4, removed: false },
  { id: 'w1', text: 'euh', start: 0.4, end: 0.5, removed: true },
  { id: 'w2', text: 'lkolajin', start: 0.5, end: 1.2, removed: false },
];

const mode = (vocabulary: string[] = []): ClientMode =>
  ({
    id: 'k2-syndicalia',
    name: 'K2 Syndicalia',
    version: 2,
    palette: { background: '#1A0000', primary: '#820000', accent: '#C9A96E', light: '#F8F6F2' },
    fonts: { status: 'tbd', note: 'n' },
    imageStyle: { stylePrompt: ['s'], negativePrompt: ['n'] },
    imageVariation: { note: 'n', axes: { crop: ['wide', 'close'] } },
    allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['img_float'] },
    vocabulary,
  }) satisfies ClientMode;

describe('candidateCountFor', () => {
  it('asks for more than it will keep, with a floor', () => {
    expect(candidateCountFor(3)).toBe(9);
    expect(candidateCountFor(12)).toBe(36);
    // The floor only binds on a reel short enough to want one or two.
    expect(candidateCountFor(1)).toBe(MIN_CANDIDATES);
  });
});

describe('buildKeywordPrompt', () => {
  const prompt = (vocabulary: string[] = []): string =>
    buildKeywordPrompt({ words, mode: mode(vocabulary), candidateCount: 9 });

  it('states the criteria in priority order', () => {
    const p = prompt();
    expect(p).toContain('1. PRIMARY: semantic weight.');
    expect(p).toContain('2. SECONDARY (tiebreak only): brand and domain vocabulary');
    expect(p.indexOf('1. PRIMARY')).toBeLessThan(p.indexOf('2. SECONDARY'));
  });

  it('rules out prosody, which nothing in this pipeline can hear', () => {
    expect(prompt()).toContain(
      'Delivery and vocal emphasis are NOT criteria. Nothing in this pipeline hears\nprosody.',
    );
  });

  it('does not show the model a removed word', () => {
    expect(prompt()).toContain('w0\tbghiti');
    expect(prompt()).not.toContain('euh');
  });

  it('passes the mode vocabulary through as an explicit term list', () => {
    expect(prompt(['Profhilo', 'RRS Eyes'])).toContain(
      "The client's own vocabulary, for criterion 2: Profhilo, RRS Eyes.",
    );
  });

  it('says so plainly when the vocabulary is empty', () => {
    expect(prompt()).toContain('The client has no vocabulary list yet');
    expect(prompt()).not.toContain("client's own vocabulary");
  });

  it('asks for short spans and against duplicate ideas under version 2', () => {
    const p = prompt();
    expect(p).toContain('Prefer a span of ONE word.');
    expect(p).toContain('Never return more than 2 words');
    expect(p).toContain('Do not return two candidates about the same thing.');
  });

  it('leaves version 1 exactly as it was measured', () => {
    const v1 = buildKeywordPrompt({ words, mode: mode(), candidateCount: 9, version: 1 });
    expect(v1).not.toContain('Prefer a span of ONE word.');
  });

  it('asks for the candidate count and refuses the model the final count', () => {
    expect(prompt()).toContain('Return the 9 strongest candidates');
    expect(prompt()).toContain('is imposed\ndownstream and is not yours to decide');
  });
});

describe('parseKeywordResponse', () => {
  it('reads the documented shape', () => {
    expect(
      parseKeywordResponse('{"candidates":[{"wordIds":["w0"],"text":"a","score":0.5,"reason":"r"}]}'),
    ).toEqual([{ wordIds: ['w0'], text: 'a', score: 0.5, reason: 'r' }]);
  });

  it('strips a markdown fence the prompt asked it not to send', () => {
    expect(
      parseKeywordResponse('```json\n{"candidates":[{"wordIds":["w0"],"text":"a","score":1,"reason":"r"}]}\n```'),
    ).toHaveLength(1);
  });

  it('throws a retryable error on unparseable JSON', () => {
    expect(() => parseKeywordResponse('sorry, here are your keywords')).toThrow(AnalysisError);
    try {
      parseKeywordResponse('nope');
    } catch (err) {
      expect((err as AnalysisError).retryable).toBe(true);
    }
  });

  it('throws when the candidates array is missing', () => {
    expect(() => parseKeywordResponse('{"keywords":[]}')).toThrow(/missing a "candidates" array/);
  });

  it('leaves a malformed candidate malformed for selection to reject', () => {
    const [c] = parseKeywordResponse('{"candidates":[{"wordIds":"w0","score":"high"}]}');
    expect(c?.wordIds).toEqual([]);
    expect(Number.isNaN(c?.score)).toBe(true);
  });
});
