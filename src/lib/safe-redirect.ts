/**
 * Post-login redirect sanitiser. Only same-origin, absolute *paths* are
 * allowed — `//evil.example`, `/\evil.example`, `https://…`, `javascript:` and
 * anything with control characters fall back to the portal home. Shared by the
 * login page (server) and the sign-in form (client).
 */
export const DEFAULT_AFTER_LOGIN = '/portal';

export function safeNextPath(raw: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const candidate = raw.trim();
  if (!candidate.startsWith('/')) return fallback;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;
  try {
    const base = 'http://chalar.invalid';
    const url = new URL(candidate, base);
    if (url.origin !== base) return fallback;
    // Never bounce back to the login page itself.
    if (url.pathname === '/login') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
