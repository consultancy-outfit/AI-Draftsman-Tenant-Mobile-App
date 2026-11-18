/**
 * =============================================================================
 * SLIDE SHORTS — the pure rules behind the story player
 * =============================================================================
 * Which slide comes next, how full each progress segment is, how far into the
 * deck the learner is (the position the view tracker is told), where a tap
 * lands (or which way a swipe pages), how a stat card counts up, whether a
 * quiz answer is right, the score the cta slide shows, and the deck's accent.
 * No React, no DOM, no store —
 * `tools/checks/ai-short-slides.spec.ts` imports this file by relative path
 * under `node --experimental-strip-types`, so every import here is type-only.
 *
 * A deck is "watched" when its last (cta) slide is reached, the same moment a
 * video's `ended` fires — so the start / 50% / end rule in
 * `createViewMilestoneTracker` applies to both formats unchanged.
 *
 * Keys are camelCase (`durationS`, `correctOptionId`) because that is what
 * b2b-core serves; ML's stored deck is snake_case and is never read here.
 * Reading the snake_case names made every silent slide last the 2 s minimum
 * and marked every right quiz answer "Not quite.".
 *
 * Nothing here is stored: quiz answers, poll picks and the score live only in
 * the player's state for as long as the short is on screen.
 * =============================================================================
 */

import type {
  AiShortDeck,
  AiShortSummary,
  AiSlide,
  AiSlideStat,
} from './aiLearning.types';

/** A short the portal renders as slides rather than as a `<video>`. */
export const isSlideShort = (
  short: Pick<AiShortSummary, 'format' | 'deck'>,
): short is Pick<AiShortSummary, 'format'> & { deck: AiShortDeck } =>
  short.format === 'slides' &&
  !!short.deck &&
  Array.isArray(short.deck.slides) &&
  short.deck.slides.length > 0;

/** A slide's length in seconds; never zero, so a timer always moves on. */
export const MIN_SLIDE_S = 2;
export const slideDuration = (slide: Pick<AiSlide, 'durationS'>): number =>
  Number.isFinite(slide.durationS) && slide.durationS > MIN_SLIDE_S
    ? slide.durationS
    : MIN_SLIDE_S;

export const deckDuration = (
  slides: Array<Pick<AiSlide, 'durationS'>>,
): number => slides.reduce((sum, s) => sum + slideDuration(s), 0);

/** Clamped step: next / previous never leaves the deck. */
export const nextSlideIndex = (current: number, length: number): number =>
  Math.min(Math.max(0, length - 1), current + 1);
export const prevSlideIndex = (current: number): number =>
  Math.max(0, current - 1);

/** How full segment `i` is while slide `current` is `slideFraction` through. */
export const segmentFill = (
  i: number,
  current: number,
  slideFraction: number,
): number => {
  if (i < current) return 1;
  if (i > current) return 0;
  return Math.min(1, Math.max(0, slideFraction));
};

/** Seconds into the deck: every finished slide plus the current one's elapsed. */
export const deckPosition = (
  slides: Array<Pick<AiSlide, 'durationS'>>,
  current: number,
  slideElapsedS: number,
): number => {
  let t = 0;
  slides.slice(0, Math.max(0, current)).forEach((s) => {
    t += slideDuration(s);
  });
  const cur = slides[current];
  const here = cur ? slideDuration(cur) : 0;
  return t + Math.min(here, Math.max(0, slideElapsedS));
};

/** 0..1 through the deck; reaching the last slide counts as the end. */
export const deckFraction = (
  slides: Array<Pick<AiSlide, 'durationS'>>,
  current: number,
  slideElapsedS: number,
): number => {
  if (slides.length === 0) return 0;
  if (current >= slides.length - 1) return 1;
  const total = deckDuration(slides);
  return total > 0
    ? Math.min(1, deckPosition(slides, current, slideElapsedS) / total)
    : 0;
};

/** True on the slide that completes the deck (the cta, or the last slide). */
export const isDeckEnd = (current: number, length: number): boolean =>
  length > 0 && current >= length - 1;

/**
 * Where a tap lands: the left third goes back, the right two thirds go
 * forward (the larger target, as in every story player).
 */
export type TapZone = 'prev' | 'next';
export const tapZone = (x: number, width: number): TapZone =>
  width > 0 && x < width / 3 ? 'prev' : 'next';

/** A press held this long is a pause, not a tap. */
export const HOLD_MS = 220;

/**
 * A swipe pages the deck when it is mostly horizontal and longer than
 * `SWIPE_PX`: left goes forward, right goes back. A vertical drag is left to
 * the feed, which scrolls between shorts.
 */
export const SWIPE_PX = 40;
export const swipeDirection = (dx: number, dy: number): TapZone | null => {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) <= SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 'next' : 'prev';
};

/** Slides the learner answers: they hold the deck until they are answered. */
export const isAskingSlide = (slide: Pick<AiSlide, 'kind'>): boolean =>
  slide.kind === 'quiz' || slide.kind === 'poll';

/**
 * A quiz or a poll holds the deck until it is answered: the narration may
 * end, but auto-advance waits for the learner.
 */
export const waitsForAnswer = (
  slide: Pick<AiSlide, 'kind'>,
  answered: boolean,
): boolean => isAskingSlide(slide) && !answered;

/** A quiz answer is right when it is the slide's `correctOptionId`. */
export const isCorrectAnswer = (
  slide: Pick<AiSlide, 'kind' | 'correctOptionId'>,
  answer: string | null | undefined,
): boolean =>
  slide.kind === 'quiz' && !!answer && answer === slide.correctOptionId;

/** The quiz score so far: right answers out of the deck's quiz slides. */
export interface QuizScore {
  correct: number;
  total: number;
}
export const quizScore = (
  slides: Array<Pick<AiSlide, 'id' | 'kind' | 'correctOptionId'>>,
  answers: Record<string, string>,
): QuizScore => {
  const quizzes = slides.filter((s) => s.kind === 'quiz');
  return {
    correct: quizzes.filter((s) => isCorrectAnswer(s, answers[s.id])).length,
    total: quizzes.length,
  };
};

/** "You got N of M right" on the cta slide; null when the deck had no quiz. */
export const scoreLine = (score: QuizScore): string | null =>
  score.total > 0 ? `You got ${score.correct} of ${score.total} right` : null;

/** What a poll says once the learner picks. No right answer, and no tally. */
export const pollThanks = (
  slide: Pick<AiSlide, 'options'>,
  answer: string | null | undefined,
): string | null => {
  if (!answer) return null;
  const option = slide.options?.find((o) => o.id === answer);
  return option ? `Thanks — you picked ${option.text}` : null;
};

/** The caption over a tryit prompt. */
export const tryItLabel = (model: string | null | undefined): string => {
  const name = model?.trim();
  return name ? `Try it with ${name}` : 'Try it yourself';
};

/**
 * The deck's theme colour: `deck.accent` when it is a hex colour, else the
 * brand accent. A malformed value never reaches a CSS string.
 */
const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export const deckAccent = (
  accent: string | null | undefined,
  fallback: string,
): string => {
  const a = accent?.trim();
  return a && HEX_COLOUR.test(a) ? a : fallback;
};

/** The badge each slide kind wears. An unknown kind gets no badge. */
const KIND_LABELS: Record<AiSlide['kind'], string> = {
  headline: 'Update',
  stat: 'The change',
  compare: 'What changed',
  facts: 'Key facts',
  why: 'Why it matters',
  who: 'Who it is for',
  roles: 'Who should care',
  tryit: 'Try it',
  quiz: 'Quick check',
  poll: 'Your take',
  cta: 'Next steps',
};
export const kindLabel = (kind: string): string | null =>
  (KIND_LABELS as Record<string, string>)[kind] ?? null;

/** How long the n-th line of a slide waits before it reveals; 0 when reduced. */
export const STAGGER_MS = 90;
export const revealDelay = (n: number, reduceMotion: boolean): number =>
  reduceMotion ? 0 : Math.max(0, Math.min(n, 8)) * STAGGER_MS;

/** The absolute link the Share button sends (or copies). */
export const shareLink = (origin: string, path: string): string =>
  `${origin.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

/** The parts of "$0.30" / "128K" / "1,000,000 tokens" a count-up animates. */
export interface CountableValue {
  prefix: string;
  value: number;
  decimals: number;
  suffix: string;
  thousands: boolean;
}

export const parseCountable = (
  text: string | null | undefined,
): CountableValue | null => {
  if (!text) return null;
  const m = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(.*)$/.exec(
    text.trim(),
  );
  if (!m) return null;
  const [, prefix = '', digits = '', fraction, suffix = ''] = m;
  const whole = digits.replace(/,/g, '');
  const decimals = fraction ? fraction.length : 0;
  const value = Number(fraction ? `${whole}.${fraction}` : whole);
  if (!whole || !Number.isFinite(value)) return null;
  return { prefix, value, decimals, suffix, thousands: digits.includes(',') };
};

/** The text a count-up shows at `progress` (0..1) of the way to `target`. */
export const countUpText = (
  target: CountableValue,
  progress: number,
): string => {
  const p = Math.min(1, Math.max(0, progress));
  const n = target.value * p;
  const fixed = n.toFixed(target.decimals);
  const [i = '0', d] = fixed.split('.');
  const intPart = target.thousands ? Number(i).toLocaleString('en-US') : i;
  return `${target.prefix}${d !== undefined ? `${intPart}.${d}` : intPart}${target.suffix}`;
};

/**
 * Which palette colour a stat takes. Deliberately not a judgement: a price
 * going up is bad news and a context window going up is good, and the stat
 * does not say which it is. The arrow shows the direction; the colour only
 * marks a value that is new.
 */
export type StatTone = 'success' | 'info';
export const statTone = (stat: Pick<AiSlideStat, 'change'>): StatTone =>
  stat.change === 'new' ? 'success' : 'info';

/** The arrow between before and after. */
const STAT_ARROWS: Record<AiSlideStat['change'], string> = {
  up: '↗',
  down: '↘',
  new: '→',
  changed: '→',
};
export const statArrow = (stat: Pick<AiSlideStat, 'change'>): string =>
  STAT_ARROWS[stat.change] ?? '→';

/** How a quiz option shows once the learner has (or has not) answered. */
export type OptionState = 'idle' | 'correct' | 'wrong' | 'muted';
export const optionState = (
  answer: string | null,
  optionId: string,
  correctId: string | null | undefined,
): OptionState => {
  if (!answer) return 'idle';
  if (optionId === correctId) return 'correct';
  return optionId === answer ? 'wrong' : 'muted';
};

/**
 * How an option shows on a quiz or a poll. A poll has no right answer, so the
 * learner's pick is highlighted and nothing is ever marked wrong.
 */
export const askOptionState = (
  slide: Pick<AiSlide, 'kind' | 'correctOptionId'>,
  answer: string | null,
  optionId: string,
): OptionState => {
  if (slide.kind !== 'poll') {
    return optionState(answer, optionId, slide.correctOptionId);
  }
  if (!answer) return 'idle';
  return optionId === answer ? 'correct' : 'muted';
};
