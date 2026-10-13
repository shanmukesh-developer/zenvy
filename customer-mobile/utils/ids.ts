/**
 * Record ids that arrive from outside the app (deep links, push payloads, notification rows) are
 * interpolated into authenticated API paths, so only plain ids are accepted: a UUID or a short
 * alphanumeric id. Anything with '/', '.', '%', '?' or '#' could otherwise point the user's Bearer
 * token at a different endpoint (e.g. zenvy://tracking/..%2Fusers%2Fme).
 */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const isSafeId = (value: unknown): value is string =>
  typeof value === 'string' && SAFE_ID_RE.test(value);

/** The id if it is safe to use in a path, otherwise undefined. */
export const safeId = (value: unknown): string | undefined => {
  const v = typeof value === 'number' ? String(value) : value;
  return isSafeId(v) ? v : undefined;
};
