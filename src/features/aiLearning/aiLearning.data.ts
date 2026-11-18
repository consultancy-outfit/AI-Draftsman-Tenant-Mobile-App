/**
 * AI Learning — user-facing strings, page sizes and filter options.
 * Ported from the web/desktop `AiLearning.data.ts`; filter options use this
 * app's `PickerOption` instead of web's `FilterSelectOption`.
 *
 * Copy that carries a claim (official vs AI-generated) is in
 * `aiLearning.logic.ts`, beside the rules, so a call site cannot soften it.
 */

import type { PickerOption } from '@/components/ui';

import { AI_CATEGORY_LABELS } from './aiLearning.logic';
import { AI_UPDATE_CATEGORIES } from './aiLearning.types';

/** Feed page size — the backend's default and well under its cap of 50. */
export const AI_FEED_PAGE_SIZE = 20;
/** Shorts page size — the backend's default; the cap is 20. */
export const AI_SHORTS_PAGE_SIZE = 5;
export const AI_HISTORY_LIMIT = 20;
export const AI_SEARCH_DEBOUNCE_MS = 350;

export const AI_CATEGORY_OPTIONS: PickerOption[] = [
  { value: '', label: 'All categories' },
  ...AI_UPDATE_CATEGORIES.map((category) => ({ value: category, label: AI_CATEGORY_LABELS[category] })),
];

export const AI_SINCE_OPTIONS: PickerOption[] = [
  { value: '', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export const AI_LEARNING_COPY = {
  title: 'AI Learning',
  feedDescription:
    'What changed at AI providers — model releases, API changes, pricing and deprecations — each linked to its official source.',
  shortsDescription: 'Short video explainers of recent AI provider updates.',
  coursesDescription:
    'Start with AI Fundamentals, then go deeper with a course per provider. Each module ends with a short quiz.',
  myDescription: 'Your AI courses, quiz results and what you have viewed recently.',
  feedEmptyTitle: 'No updates match these filters',
  feedEmptyDescription: 'Try another provider, category or date range.',
  feedNothingTitle: 'No provider updates yet',
  feedNothingDescription: 'Updates appear here as AI providers publish them.',
  unavailableTitle: 'The AI feed is unavailable right now',
  unavailableDescription:
    'Provider updates and shorts could not be reached. Courses and your progress are unaffected — try again in a moment.',
  loadFailedTitle: 'This could not be loaded',
  loadFailedDescription: 'Something went wrong on our side. Try again.',
  notFoundTitle: 'Not found',
  notFoundDescription: 'This item does not exist, or it is not published yet.',
  retry: 'Try again',
  shortsEmptyTitle: 'No shorts yet',
  shortsEmptyDescription: 'Video explainers appear here as provider updates are published.',
  videoErrorTitle: 'This video could not be played',
  videoErrorDescription: 'The link may have expired. Reload to fetch a fresh one, or swipe to the next short.',
  coursesEmptyTitle: 'No AI courses published yet',
  markComplete: 'Mark complete',
  completed: 'Completed',
  completeFailed: 'Could not mark this lesson complete',
  quizSubmitFailed: 'Could not submit your answers',
  attemptsExhaustedTitle: 'No attempts left',
  attemptsExhaustedDescription: 'You have used every attempt on this quiz. Your best score still counts towards the course.',
  invalidAnswers: 'The quiz changed while you were answering. It has been reloaded — try again.',
  comingSoonTitle: 'Coming soon on mobile',
  comingSoonDescription: 'This section is on the way. It is already available on the web and desktop apps.',
} as const;

export type AiLearningTab = 'feed' | 'shorts' | 'courses' | 'my';

export const AI_LEARNING_TABS: Array<{ value: AiLearningTab; label: string }> = [
  { value: 'feed', label: 'AI Feed' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'courses', label: 'AI Courses' },
  { value: 'my', label: 'My progress' },
];
