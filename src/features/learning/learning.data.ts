/**
 * Learning — user-facing strings and filter options. Ported from the web/desktop
 * `Learning.data.ts`; filters use this app's `PickerOption` (no `triggerLabel`).
 *
 * Copy that carries a claim lives here so it cannot be softened at a call site:
 * the not-a-qualification disclaimer, the self-rating caveat and the
 * evidence-is-unverified line are each shown verbatim wherever they apply.
 */

import type { PickerOption } from '@/components/ui';

export { LEARNING_DISCLAIMER } from './learning.logic';

export const MARKETPLACE_PAGE_SIZE = 12;
export const KSB_PAGE_SIZE = 20;
export const COMPETENCY_PAGE_SIZE = 20;
/** Fetched in one page when virtualising, so the list scrolls instead of pages. */
export const COMPETENCY_VIRTUAL_PAGE_SIZE = 100;
export const SEARCH_DEBOUNCE_MS = 350;

export const LEVEL_FILTER_OPTIONS: PickerOption[] = [
  { value: '', label: 'All levels' },
  ...[2, 3, 4, 5, 6, 7].map((level) => ({
    value: String(level),
    label: `Level ${level}`,
  })),
];

/**
 * Routes (sectors) — Skills England's fifteen occupational routes, spelled as
 * the catalogue stores them in `ApprenticeshipSummary.route`. The catalogue
 * takes `route` as a filter but has no endpoint listing routes, so the
 * published taxonomy is the list; a route with no courses simply returns none.
 */
export const ROUTE_FILTER_OPTIONS: PickerOption[] = [
  { value: '', label: 'All routes' },
  ...[
    'Agriculture, environmental and animal care',
    'Business and administration',
    'Care services',
    'Catering and hospitality',
    'Construction and the built environment',
    'Creative and design',
    'Digital',
    'Education and early years',
    'Engineering and manufacturing',
    'Hair and beauty',
    'Health and science',
    'Legal, finance and accounting',
    'Protective services',
    'Sales, marketing and procurement',
    'Transport and logistics',
  ].map((route) => ({ value: route, label: route })),
];

export const ENROLMENT_FILTER_OPTIONS: PickerOption[] = [
  { value: '', label: 'Any enrolment' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'not_enrolled', label: 'Not enrolled' },
];

export const FAVOURITE_FILTER_OPTIONS: PickerOption[] = [
  { value: '', label: 'All courses' },
  { value: 'true', label: 'Workspace favourites' },
];

export const LEARNING_COPY = {
  marketplaceDescription:
    'Published apprenticeship standards you can learn with an AI tutor. Enrol in as many as you like.',
  searchPlaceholder: 'Search apprenticeships',
  noResultsTitle: 'No apprenticeships match',
  noResultsDescription: 'Try a different search or clear a filter.',
  emptyCatalogueTitle: 'No apprenticeships are published yet',
  loadFailedTitle: 'We could not load this',
  loadFailedDescription: 'Check your connection and try again.',
  retry: 'Try again',
  viewDetails: 'View details',
  unavailableTitle: 'This apprenticeship is not available',
  unavailableDescription:
    'It has been unpublished or withdrawn. Courses you are already enrolled in stay in My Learning.',
  enrolFailed: 'We could not enrol you.',
  tutorName: 'AI tutor',
  tutorDrafting: 'The tutor is answering…',
  tutorNewMessages: 'New messages',
  tutorFocus: 'Focus',
  tutorFocusHint:
    'Your next message is about this item. Pick another item on the left to change it.',
  tutorPlaceholder: 'Ask your tutor anything',
  tutorPlaceholderDisabled: 'Start a session to message your tutor',
  coursePanelLabel: 'Course & plan',
  showCoursePanel: 'Show course & plan',
  hideCoursePanel: 'Hide course & plan',
  hideCoursePanelShort: 'Hide',
  addFavourite: 'Add to workspace favourites',
  removeFavourite: 'Remove from workspace favourites',
  favouriteFailed: 'We could not update your favourites.',
  myLearningDescription:
    'Every course you are enrolled in, each with its own progress.',
  noEnrolmentsTitle: 'You are not enrolled in anything yet',
  noEnrolmentsDescription:
    'Browse the Apprenticeship Marketplace to find a course.',
  browse: 'Browse apprenticeships',
  selfRatingCaveat: "Your own rating — doesn't change assessed progress",
  evidenceCaveat: 'Submitted by you — not verified by an assessor',
  tutorUnavailableTitle: 'AI tutor is unavailable right now',
  tutorUnavailableDescription:
    'Your message was saved, but the tutor could not answer it. No reply has been generated. Try again in a moment.',
  migrateTitle: 'Move to the latest version?',
  migrateBody:
    'Items that have not changed keep their progress. Changed and retired items keep their history and the version they were assessed against; new items start as Not started. This cannot be undone.',
  migrateConfirm: 'Move to latest version',
} as const;
