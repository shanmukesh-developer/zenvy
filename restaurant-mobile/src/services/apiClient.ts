// The one HTTP client for the partner app: 15 s timeout, Bearer token read at call time,
// JSON in/out, and every failure turned into ApiError (server answered) or NetworkError (it didn't).
import { API_URL } from '../constants/api';

export class ApiError extends Error {
  status: number;
  code?: string;
  data: any;
  constructor(status: number, message: string, data: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = data && typeof data.code === 'string' ? data.code : undefined;
    this.data = data;
  }
}

export class NetworkError extends Error {
  constructor(message = "Couldn't reach Zenvy. Check your internet and try again.") {
    super(message);
    this.name = 'NetworkError';
  }
}

let getToken: () => string | null = () => null;
let onUnauthorized: (() => void) | null = null;

export function configureApiClient(opts: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError || err instanceof NetworkError) return err.message;
  return fallback;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  /** false for login: a 401 there means a wrong password, not an expired session. */
  auth?: boolean;
  /** Treat a 401 as an ordinary error instead of logging out (legacy item-missing 401s). */
  no401Logout?: boolean;
}

export async function apiFetch<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = 15000, auth = true, no401Logout = false } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    throw new NetworkError(
      e?.name === 'AbortError'
        ? 'Zenvy is taking too long to answer. Please try again.'
        : "Couldn't reach Zenvy. Check your internet and try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    if (res.status === 401 && auth && !no401Logout && onUnauthorized) onUnauthorized();
    const msg = (data && typeof data.message === 'string' && data.message) ||
      (res.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.'
        : res.status >= 500 ? 'Zenvy is having trouble right now. Please try again in a moment.'
          : 'Request failed. Please try again.');
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}
