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
