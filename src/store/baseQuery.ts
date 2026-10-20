import type { BaseQueryFn } from '@reduxjs/toolkit/query';

import { apiRequest, ApiError, NetworkError, type RequestOptions } from '@/services/httpClient';
import { clearAllCookies } from '@/services/cookieAuth';

import { sessionExpired } from './authSlice';

export interface ApiRequestArgs {
  url: string;
  method?: RequestOptions['method'];
  body?: unknown;
  query?: RequestOptions['query'];
  /** Auth endpoints that must NOT send the session cookie (none currently —
   * every auth route relies on either no cookie or the OTP ticket cookie,
   * both handled by httpClient's own cookie-jar read), kept for parity with
   * apiRequest's own option. */
  skipAuthHeader?: boolean;
  /** Extra request headers — currently just `Idempotency-Key` on a couple
   * of write endpoints (customer register, import apply) that need
   * double-tap/retry safety on a flaky mobile connection. Merged under
   * the Content-Type/Cookie headers httpClient sets itself, so this can't
   * override either. */
  headers?: Record<string, string>;
}

export interface ApiQueryError {
  status: number | 'NETWORK_ERROR';
  messages: string[];
  details: unknown;
  code: string | undefined;
  retryAfterSeconds: number | undefined;
}

/**
 * RTK Query baseQuery wrapping the low-level apiRequest — see httpClient.ts
 * for the shared cookie-attachment and error-normalisation logic. This layer
 * adds exactly one thing: the 401 latch. A 401 on an authenticated route
 * means the session cookie is gone or expired (natural 7-day expiry, or a
 * revoked session) — dispatched once as `sessionExpired`, not once per
 * in-flight request, by checking current phase before dispatching rather
 * than a module-level mutable flag (which would leak across store
 * instances, e.g. in tests).
 */
/**
 * Is the session REALLY gone? One shared check for every 401 that lands at
 * the same moment (a screen often fires several requests together), so a
 * burst of 401s costs one `/auth/session` call, not one each.
 *
 * Why it exists: a 401 from one endpoint used to sign the user out on the
 * spot. On a real iPhone that fired when the session was fine — the device
 * keeps two cookie stores, and a request can go out carrying a stale cookie
 * while the session itself is valid (a simulator does not show this). One
 * wrong 401 must not throw away a good session, so the session endpoint
 * decides: 401 there → signed out; 200 → the session stands.
 * A network failure during the check also keeps the user signed in.
 */
let sessionCheck: Promise<'valid' | 'expired' | 'unknown'> | null = null;
function confirmSession(): Promise<'valid' | 'expired' | 'unknown'> {
  if (!sessionCheck) {
    /* GET /auth/session always answers 200 — a dead session reads
     * `authenticated: false`, it is not a 401. */
    sessionCheck = apiRequest<{ authenticated?: boolean } | null>('/auth/session', { method: 'GET' })
      .then((res) => (res && res.authenticated === false ? ('expired' as const) : ('valid' as const)))
      .catch((e: unknown) => (e instanceof ApiError && e.isUnauthorized ? ('expired' as const) : ('unknown' as const)))
      .finally(() => {
        /* Re-check on the next burst, not forever. */
        setTimeout(() => {
          sessionCheck = null;
        }, 2000);
      });
  }
  return sessionCheck;
}

const isAuthRoute = (url: string) => url.startsWith('/auth/');

export const baseQuery: BaseQueryFn<ApiRequestArgs, unknown, ApiQueryError> = async (args, api) => {
  const send = () =>
    apiRequest(args.url, {
      method: args.method,
      body: args.body,
      query: args.query,
      skipAuthHeader: args.skipAuthHeader,
      headers: args.headers,
    });

  try {
    let data: unknown;
    try {
      data = await send();
    } catch (first) {
      /* A 401 on an ordinary route while signed in: confirm the session
         before treating it as expired (see `confirmSession`). */
      const state = api.getState() as { auth?: { phase?: string } };
      if (first instanceof ApiError && first.isUnauthorized && !isAuthRoute(args.url) && state.auth?.phase === 'authenticated') {
        const verdict = await confirmSession();
        if (verdict !== 'expired') {
          console.warn(`[auth] 401 from ${args.method ?? 'GET'} ${args.url} while the session is ${verdict} - retrying once, not signing out.`);
          try {
            data = await send();
          } catch (again) {
            /* Still 401: the error goes to the screen, the user stays signed in. */
            if (again instanceof ApiError && again.isUnauthorized) return { error: toApiQueryError(again) };
            throw again;
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return { data: data ?? null };
        }
      }
      throw first;
    }
    // A success response with no JSON body (e.g. logout's 204) resolves
    // `data` to `undefined`. RTK Query's dev-mode result validation treats
    // `{ data: undefined }` as invalid, so `null` stands in for it.
    return { data: data ?? null };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.isUnauthorized) {
        const state = api.getState() as { auth?: { phase?: string } };
        if (state.auth?.phase === 'authenticated') {
          /* Reached only when `/auth/session` itself said 401 (or for an
             auth route): the session really is gone. */
          api.dispatch(sessionExpired());
          // Stale/expired cookie hygiene — awaited so the next request (the
          // sign-in) never builds its Cookie header mid-clear.
          await clearAllCookies();
        }
      }
      return { error: toApiQueryError(err) };
    }
    if (err instanceof NetworkError) {
      return {
        error: {
          status: 'NETWORK_ERROR',
          messages: [err.message],
          details: undefined,
          code: undefined,
          retryAfterSeconds: undefined,
        },
      };
    }
    throw err;
  }
};

function toApiQueryError(err: ApiError): ApiQueryError {
  return {
    status: err.statusCode,
    messages: err.messages,
    details: err.details,
    code: err.code,
    retryAfterSeconds: err.retryAfterSeconds,
  };
}
