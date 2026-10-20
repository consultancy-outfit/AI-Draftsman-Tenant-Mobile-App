import CookieManager from '@preeternal/react-native-cookie-manager';
import { Platform } from 'react-native';

import { env } from '@/config/env';

/**
 * Option C — native cookie jar.
 *
 * The backend issues the session as an httpOnly `Set-Cookie: b2b_session`
 * header and never returns a token in a response body (confirmed against
 * both the backend source and the live OpenAPI spec — see
 * conflicts-and-risks.md R-1). `httpOnly` blocks a browser's
 * `document.cookie`, but it does NOT block native OS cookie-store APIs
 * (NSHTTPCookieStorage / Android CookieManager) — those operate below the
 * browser-JS layer entirely, which is what makes this approach viable.
 *
 * We do not rely on RN's networking layer to attach cookies to outgoing
 * requests implicitly (behaviour that varies across RN/OkHttp versions and
 * was flagged as a reliability risk during planning). Instead this module
 * is the single explicit source of truth: httpClient reads the cookie
 * here and sets the `Cookie` header itself on every request. RN's fetch,
 * unlike a browser's, does not forbid manually setting the `Cookie`
 * header — that restriction is browser-only.
 */

/**
 * Every call below goes through one FIFO queue.
 *
 * `CookieManager` is a single native module: a read (`getCookieHeader`)
 * and a wipe (`clearAll`) issued concurrently race on the same underlying
 * cookie store, and on a sign-out immediately followed by a sign-in that is
 * exactly what happens — the outgoing `POST /auth/credentials` builds its
 * Cookie header while sign-out's `clearAll` is still in flight. Depending
 * on which lands first the request either carries a dead session cookie or
 * stalls on the bridge, so `credentialsAccepted` never dispatches and the
 * user is left staring at the Login screen with no OTP step. Serialising
 * removes the race outright: a header build started after a clear always
 * sees the cleared jar, and never overlaps it.
 */
let cookieOperations: Promise<unknown> = Promise.resolve();

function serialise<T>(operation: () => Promise<T>): Promise<T> {
  // `.then(op, op)` so one rejected operation can't wedge the queue.
  const result = cookieOperations.then(operation, operation);
  cookieOperations = result.catch(() => undefined);
  return result;
}

const OTP_COOKIE_NAME = 'b2b_otp';
const SESSION_COOKIE_NAME = 'b2b_session';

/**
 * Reads the WebKit cookie store first (`useWebKit: true` — `WKHTTPCookieStore`,
 * the jar a `WKWebView` would see), then falls back to the Foundation store
 * (`NSHTTPCookieStorage.shared`, `useWebKit: false`) if that comes back
 * empty. The two are genuinely separate jars on iOS. This app has no
 * WKWebView and never calls `CookieManager.set()`/`setFromResponse()`
 * itself — the session cookie only ever gets into a store because native
 * `fetch()` (URLSession) auto-persists the backend's `Set-Cookie` response
 * header, and URLSession's default configuration writes to the FOUNDATION
 * store, not WebKit's. Reading webkit-only was therefore finding an empty
 * jar every time (not intermittently) even though the session was
 * genuinely valid — REST calls kept working because they go through
 * `fetch()` directly rather than through this read path. Trying both,
 * webkit first, keeps this working if a future WKWebView-based flow (e.g.
 * an OAuth connector) ever writes the cookie into that store instead.
 */
async function getCookieValue(name: string): Promise<string | undefined> {
  /* Foundation FIRST. It is the jar URLSession writes every Set-Cookie
   * into, so it always holds the current session. On a real iPhone the
   * WebKit jar can hold an OLDER b2b_session (it is synced from the shared
   * store at times the simulator never does), and reading that first sent
   * a revoked token to the socket. WebKit is only a fallback now. */
  const foundationCookies = await serialise(() => CookieManager.get(env.apiOrigin, false));
  if (foundationCookies[name]?.value) return foundationCookies[name].value;
  const webkitCookies = await serialise(() => CookieManager.get(env.apiOrigin, true));
  return webkitCookies[name]?.value;
}

export async function getSessionCookie(): Promise<string | undefined> {
  return getCookieValue(SESSION_COOKIE_NAME);
}

export async function getOtpTicketCookie(): Promise<string | undefined> {
  return getCookieValue(OTP_COOKIE_NAME);
}

/**
 * Builds the `Cookie` header for an outgoing request, using the native
 * module's own header builder so Path/Domain matching against
 * `env.apiOrigin` (e.g. the `b2b_otp` cookie's `Path=/api/v1/auth`
 * scoping) is resolved by the same logic a real cookie store uses,
 * rather than reimplemented here.
 *
 * Deliberately webkit-only, NOT mirroring `getCookieValue`'s Foundation
 * fallback. Measured live: adding that fallback here made login pass
 * credentials + OTP (both 201) and then every following authenticated
 * request 401 — the explicitly-attached Foundation-store header overrides
 * whatever URLSession would have sent implicitly, and it disagreed with
 * that in some way the backend rejected (stale relative to the session
 * cookie `verify-otp`'s response had just set, or formatted differently
 * from the header URLSession itself would build). httpClient already
 * tolerates this returning `undefined` — it just omits the header
 * (httpClient.ts's `if (cookieHeader) headers['Cookie'] = ...`) and lets
 * `fetch()`'s own implicit attachment from the Foundation store carry the
 * request, which is how every REST call has always actually authenticated.
 * `getSessionCookie()` still needs the Foundation fallback: the chat
 * socket has no implicit-attachment equivalent and reads the raw token
 * itself, so it has no fallback path to fall back to.
 */
export async function buildCookieHeader(): Promise<string | undefined> {
  /* iOS: never attach an explicit Cookie header. fetch/XHR (URLSession)
   * already attach the Foundation store's cookies implicitly, and an
   * explicit header built from the WebKit jar overrode them with a STALE
   * b2b_session on real devices — every request then 401'd ("Unauthorized"
   * on the transcript, empty modules), while the simulator, whose WebKit
   * jar stays empty, worked. Android keeps the old path (one shared jar). */
  if (Platform.OS === 'ios') return undefined;
  const header = await serialise(() => CookieManager.getCookieHeader(env.apiOrigin, true));
  return header.length > 0 ? header : undefined;
}

export async function hasSessionCookie(): Promise<boolean> {
  const value = await getSessionCookie();
  return Boolean(value);
}

/**
 * Clears every cookie for the API origin. Called on logout and on a
 * hard sign-out (e.g. 423 account-disabled) — native cookie stores are
 * not cleared automatically by the app being "logged out" in JS state,
 * so skipping this would leave a valid session cookie sitting on a
 * shared or reset device.
 */
export async function clearAllCookies(): Promise<void> {
  // Both stores — see `getCookieValue`'s note. Clearing only the WebKit jar
  // would leave the session cookie sitting untouched in the Foundation
  // store it actually lives in, defeating the point of a hard sign-out.
  await serialise(() => CookieManager.clearAll(true));
  await serialise(() => CookieManager.clearAll(false));
}
