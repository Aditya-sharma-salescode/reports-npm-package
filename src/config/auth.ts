export function getAccessToken(): string {
  return localStorage.getItem('authToken') || '';
}

export function getTenantId(): string {
  return localStorage.getItem('accountId') || '';
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
