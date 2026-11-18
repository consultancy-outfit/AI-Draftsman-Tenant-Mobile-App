import { useCallback, useRef } from 'react';

import { useToast } from '@/components/ui';
import { newIdempotencyKey } from '@/utils/ids';

import { LEARNING_COPY } from './learning.data';
import { enrolOutcome } from './learning.logic';
import { useEnrollMutation } from './learningApi';

/**
 * Enrol in a course. One Idempotency-Key per course, kept across retries, so a second tap or a retry after
 * a flaky connection returns the same enrolment instead of making another. Calls `onDone` with the
 * enrolment id (a new enrolment or the existing one — both open the workspace).
 */
export function useEnrol(onDone: (enrollmentId: string) => void) {
  const toast = useToast();
  const [enroll, { isLoading }] = useEnrollMutation();
  const keys = useRef(new Map<string, string>());

  const run = useCallback(
    async (apprenticeshipId: string) => {
      let key = keys.current.get(apprenticeshipId);
      if (!key) {
        key = newIdempotencyKey();
        keys.current.set(apprenticeshipId, key);
      }
      try {
        const result = await enroll({ apprenticeshipId, idempotencyKey: key }).unwrap();
        const outcome = enrolOutcome(result);
        keys.current.delete(apprenticeshipId);
        toast.show(outcome.message, { tone: 'success' });
        onDone(outcome.enrollmentId);
      } catch {
        /* The key is kept: a retry is the same action. */
        toast.show(LEARNING_COPY.enrolFailed, { tone: 'error' });
      }
    },
    [enroll, onDone, toast],
  );
  return { enrol: run, isEnrolling: isLoading };
}
