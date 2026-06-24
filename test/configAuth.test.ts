import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAccessToken,
  getTenantId,
  getAuthContext,
  getDatastreamHeaders,
  getHostHeaders,
  syncAuthFromCookies,
} from '../src/config/auth';

describe('config/auth', () => {
  beforeEach(() => {
    localStorage.clear();
    // Clear any cookies the cookie-sync tests set.
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
  });

  afterEach(() => localStorage.clear());

  describe('getAccessToken / getTenantId', () => {
    it('returns empty strings when nothing is stored', () => {
      expect(getAccessToken()).toBe('');
      expect(getTenantId()).toBe('');
    });

    it('reads authToken and accountId from localStorage', () => {
      localStorage.setItem('authToken', 'jwt-123');
      localStorage.setItem('accountId', 'tenant-1');
      expect(getAccessToken()).toBe('jwt-123');
      expect(getTenantId()).toBe('tenant-1');
    });
  });

  describe('getAuthContext', () => {
    it('returns empty fields when authContext is missing', () => {
      expect(getAuthContext()).toEqual({ loginId: '', email: '' });
    });

    it('parses loginId and email from a valid authContext', () => {
      localStorage.setItem(
        'authContext',
        JSON.stringify({ user: { loginId: 'L9', email: 'a@x.com' } }),
      );
      expect(getAuthContext()).toEqual({ loginId: 'L9', email: 'a@x.com' });
    });

    it('returns empty fields when authContext has no user', () => {
      localStorage.setItem('authContext', JSON.stringify({ foo: 'bar' }));
      expect(getAuthContext()).toEqual({ loginId: '', email: '' });
    });

    it('returns empty fields for corrupt JSON', () => {
      localStorage.setItem('authContext', '{not json');
      expect(getAuthContext()).toEqual({ loginId: '', email: '' });
    });
  });

  describe('getDatastreamHeaders', () => {
    it('always sets Content-Type and X-Tenant-ID', () => {
      localStorage.setItem('accountId', 'tenant-1');
      const h = getDatastreamHeaders();
      expect(h['Content-Type']).toBe('application/json');
      expect(h['X-Tenant-ID']).toBe('tenant-1');
    });

    it('omits Authorization when there is no token', () => {
      expect(getDatastreamHeaders().Authorization).toBeUndefined();
    });

    it('adds a Bearer prefix to a raw token', () => {
      localStorage.setItem('authToken', 'raw-token');
      expect(getDatastreamHeaders().Authorization).toBe('Bearer raw-token');
    });

    it('does not double-prefix an already-Bearer token', () => {
      localStorage.setItem('authToken', 'Bearer already');
      expect(getDatastreamHeaders().Authorization).toBe('Bearer already');
    });
  });

  describe('getHostHeaders', () => {
    it('sets lob to the tenant id and adds Bearer auth', () => {
      localStorage.setItem('accountId', 'tenant-9');
      localStorage.setItem('authToken', 'tok');
      const h = getHostHeaders();
      expect(h.lob).toBe('tenant-9');
      expect(h.Authorization).toBe('Bearer tok');
    });

    it('omits Authorization with no token', () => {
      expect(getHostHeaders().Authorization).toBeUndefined();
    });
  });

  describe('syncAuthFromCookies', () => {
    it('copies ACCOUNT_ID and SALESHUB_TOKEN cookies into localStorage', () => {
      document.cookie = 'ACCOUNT_ID=cookie-tenant';
      document.cookie = 'SALESHUB_TOKEN=cookie-token';
      syncAuthFromCookies();
      expect(localStorage.getItem('accountId')).toBe('cookie-tenant');
      expect(localStorage.getItem('authToken')).toBe('cookie-token');
    });

    it('leaves localStorage untouched when cookies are absent', () => {
      syncAuthFromCookies();
      expect(localStorage.getItem('accountId')).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull();
    });

    it('decodes URL-encoded cookie values', () => {
      document.cookie = `ACCOUNT_ID=${encodeURIComponent('a b/c')}`;
      syncAuthFromCookies();
      expect(localStorage.getItem('accountId')).toBe('a b/c');
    });
  });
});
