/** Read a cookie value by name */
function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Sync accountId & authToken from shared cookies into localStorage.
 * The host portal (platform.salescodeai.com) sets these cookies with
 * domain=.salescodeai.com so they are available on all subdomains.
 *
 * Call this once at app startup, before any API calls are made.
 */
export function syncAuthFromCookies(): void {
  const accountId = getCookie('ACCOUNT_ID');
  const authToken = getCookie('SALESHUB_TOKEN');

  if (accountId) {
    localStorage.setItem('accountId', accountId);
  }
  if (authToken) {
    localStorage.setItem('authToken', authToken);
  }
}

export function getAccessToken(): string {
  return localStorage.getItem('authToken') || '';
}

export function getTenantId(): string {
  return localStorage.getItem('accountId') || '';
}

/** Decodes a JWT payload without verifying it. Returns null on any malformed input. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * The signed-in user's org type (e.g. "DISTRIBUTOR"), or '' when the session
 * has none. Checked in order of trustworthiness:
 *   1. `org_type` inside the access token — signed by the backend, and present
 *      whether the session was started by this app or a host portal.
 *   2. `authContext` / `salescodeaiAuth` in localStorage — what host apps write.
 *   3. The `ORG_TYPE` cookie, for portals that publish it alongside ACCOUNT_ID.
 *
 * An absent org type is meaningful, not an error: it identifies an admin-tier
 * session (see `getReportConfigDomainType`).
 */
export function getOrgType(): string {
  const claims = decodeJwtPayload(getAccessToken());
  const fromToken = typeof claims?.org_type === 'string' ? claims.org_type : '';
  if (fromToken) return fromToken.trim();

  for (const key of ['authContext', 'salescodeaiAuth']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        orgType?: unknown;
        user?: { orgType?: unknown };
      };
      const value = parsed?.orgType ?? parsed?.user?.orgType;
      if (typeof value === 'string' && value.trim()) return value.trim();
    } catch {
      /* malformed entry — fall through to the next source */
    }
  }

  return getCookie('ORG_TYPE').trim();
}

/**
 * Config-driven value for the `x-parent-tenant-id` header, sourced from the
 * selected report config (sendParentHeader + parentHeaderValue). Set when a
 * report is selected, cleared on back. When empty, the header is omitted.
 *
 * Deliberately NOT persisted to localStorage: it is per-report, so a stale value
 * must not survive a reload or leak onto a different report.
 */
let parentTenantId = '';

/** Set (or clear) the config-driven parent tenant id. Pass '' to disable the header. */
export function setParentTenantId(value: string | null | undefined): void {
  parentTenantId = (value ?? '').trim();
}

/** Read the config-driven parent tenant id. */
export function getParentTenantId(): string {
  return parentTenantId;
}

export function getAuthContext(): { loginId: string; email: string } {
  try {
    const raw = localStorage.getItem('authContext') || '{}';
    const ctx = JSON.parse(raw);
    return {
      loginId: ctx?.user?.loginId || '',
      email: ctx?.user?.email || '',
    };
  } catch {
    return { loginId: '', email: '' };
  }
}

/** Standard headers for datastream API calls */
export function getDatastreamHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-ID': getTenantId(),
  };
  const parent = getParentTenantId();
  if (parent) {
    headers['x-parent-tenant-id'] = parent;
  }
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
}

/**
 * Standard headers for saleshub API calls (distributor list).
 * No `lob` header: it isn't in the saleshub CORS allowlist, so sending it fails
 * preflight in the browser. Tenant identity comes from the cookies that
 * withCredentials sends automatically, same as the other APIs.
 */
export function getSaleshubHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
}

/** Standard headers for host API calls */
export function getHostHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    lob: getTenantId(),
  };
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
}
