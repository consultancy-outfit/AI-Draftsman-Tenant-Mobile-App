import { env } from '@/config/env';
import { buildCookieHeader } from './cookieAuth';

/**
 * Normalised API error. The backend has two overlapping error shapes
 * (see backend-auth-tenancy.md §6.1-6.2):
 *
 *   Nest ValidationPipe (400 only): { statusCode, message: string[], error }
 *   GlobalExceptionFilter (everything else): { statusCode, message: string, errors, details }
 *   Rate limiter (429/503): adds a top-level `retryAfter` + a `Retry-After` header
 *
 * `message` is a string for hand-thrown errors and a string[] for
 * validation failures — every call site must handle both, so we
 * normalise to `messages: string[]` here once, rather than re-deriving
 * this at every screen.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly messages: string[];
  readonly details: unknown;
  readonly retryAfterSeconds: number | undefined;
  /** e.g. `details.code === 'report_run_in_flight'` — a stable branch key some routes attach. */
  readonly code: string | undefined;

  constructor(params: {
    statusCode: number;
    messages: string[];
    details?: unknown;
    retryAfterSeconds?: number;
    code?: string;
  }) {
    super(params.messages[0] ?? `Request failed (${params.statusCode})`);
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    this.messages = params.messages;
    this.details = params.details;
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.code = params.code;
  }

  get isValidationError() {
    return this.statusCode === 400;
  }
  get isUnauthorized() {
    return this.statusCode === 401;
  }
  get isPaymentOrQuota() {
    return this.statusCode === 402;
  }
  get isForbidden() {
    return this.statusCode === 403;
  }
  get isNotFound() {
    return this.statusCode === 404;
  }
  get isConflict() {
    return this.statusCode === 409;
  }
  get isGone() {
    return this.statusCode === 410;
  }
  get isPreconditionFailed() {
    return this.statusCode === 412;
  }
  get isAccountLocked() {
    return this.statusCode === 423;
  }
  get isRateLimited() {
    return this.statusCode === 429;
  }
  get isServerError() {
    return this.statusCode >= 500;
  }
}

/** Thrown when the device has no network connectivity at all (fetch itself threw). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Unable to reach the server. Check your connection and try again.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

function extractMessages(body: unknown): string[] {
  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    body.message != null
  ) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.map(String);
    return [String(m)];
  }
  return ['Something went wrong. Please try again.'];
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  /** Set by the RTK Query baseQuery after a 401 — skips the cookie/auth dance for auth endpoints. */
  skipAuthHeader?: boolean;
  signal?: AbortSignal;
}

function buildUrl(
  path: string,
  query?: RequestOptions['query'],
): string {
  const url = new URL(
    path.startsWith('http') ? path : `${env.apiBaseUrl}${path}`,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Low-level request function. Callers should generally go through the
 * RTK Query baseQuery (src/store/baseQuery.ts) rather than this
 * directly, so the 401 latch and retry/backoff behaviour are applied
 * consistently — this is exported for the small number of call sites
 * (session bootstrap, file upload) that need raw control.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, options.query);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(env.isTunnel ? { 'ngrok-skip-browser-warning': 'true' } : null),
    ...options.headers,
  };

  /* A multipart body (a logo upload, so far — see `branding` feature)
   * must NOT get a hand-set `Content-Type`: RN's `fetch` derives one from
   * the `FormData` itself, including the multipart boundary, and
   * overriding it here produces a boundary-less header the server reads
   * as malformed. Every other caller still passes a plain object and is
   * unaffected — this is a new branch, not a changed one. */
  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (!options.skipAuthHeader) {
    const cookieHeader = await buildCookieHeader();
    if (cookieHeader) headers['Cookie'] = cookieHeader;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const rawBody = contentType.includes('application/json')
    ? await response.json().catch(() => undefined)
    : undefined;

  if (!response.ok) {
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSeconds =
      retryAfterHeader != null
        ? Number(retryAfterHeader)
        : rawBody &&
            typeof rawBody === 'object' &&
            'retryAfter' in rawBody
          ? Number((rawBody as { retryAfter: unknown }).retryAfter)
          : undefined;

    const details =
      rawBody && typeof rawBody === 'object' && 'details' in rawBody
        ? (rawBody as { details: unknown }).details
        : undefined;

    const code =
      details && typeof details === 'object' && 'code' in details
        ? String((details as { code: unknown }).code)
        : undefined;

    throw new ApiError({
      statusCode: response.status,
      messages: extractMessages(rawBody),
      details,
      retryAfterSeconds:
        Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
      code,
    });
  }

  return rawBody as T;
}
