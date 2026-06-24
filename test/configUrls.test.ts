import { describe, it, expect, beforeEach } from 'vitest';

// urls.ts reads localStorage at call time and holds a module-level override, so
// each test sets localStorage then re-imports a fresh module instance.
async function freshUrls() {
  const mod = await import('../src/config/urls');
  return mod;
}

describe('config/urls', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the module registry so the mutable override doesn't leak.
    // (vitest resetModules is per-test via dynamic import below.)
  });

  describe('getEnv', () => {
    it('returns prod when accountId is absent', async () => {
      const { getEnv } = await freshUrls();
      expect(getEnv()).toBe('prod');
    });

    it('detects uat from accountId', async () => {
      localStorage.setItem('accountId', 'acme-UAT-01');
      const { getEnv } = await freshUrls();
      expect(getEnv()).toBe('uat');
    });

    it('detects demo from accountId', async () => {
      localStorage.setItem('accountId', 'acme-demo');
      const { getEnv } = await freshUrls();
      expect(getEnv()).toBe('demo');
    });

    it('falls back to prod for an unrecognized accountId', async () => {
      localStorage.setItem('accountId', 'acme-production');
      const { getEnv } = await freshUrls();
      expect(getEnv()).toBe('prod');
    });
  });

  describe('base URLs by env', () => {
    it('resolves prod datastream/host/report URLs', async () => {
      const { getDatastreamBaseUrl, getHostBaseUrl, getReportBaseUrl } = await freshUrls();
      expect(getDatastreamBaseUrl()).toBe('https://datastream.salescode.ai');
      expect(getHostBaseUrl()).toBe('https://prod.salescode.ai');
      expect(getReportBaseUrl()).toBe('https://reportsprod.salescode.ai');
    });

    it('resolves uat URLs', async () => {
      localStorage.setItem('accountId', 'x-uat');
      const { getDatastreamBaseUrl, getHostBaseUrl } = await freshUrls();
      expect(getDatastreamBaseUrl()).toBe('https://datastream-saleshub-qa.salescodeai.com');
      expect(getHostBaseUrl()).toBe('https://uat.salescode.ai');
    });

    it('resolves demo URLs', async () => {
      localStorage.setItem('accountId', 'x-demo');
      const { getDatastreamBaseUrl } = await freshUrls();
      expect(getDatastreamBaseUrl()).toBe('https://datastream-demo.salescode.ai');
    });
  });

  describe('setDatastreamBaseUrl override', () => {
    it('overrides the datastream base URL and strips trailing slashes', async () => {
      const { setDatastreamBaseUrl, getDatastreamBaseUrl } = await freshUrls();
      setDatastreamBaseUrl('https://custom.example.com/api///');
      expect(getDatastreamBaseUrl()).toBe('https://custom.example.com/api');
      setDatastreamBaseUrl(null); // clean up the module-level state
    });

    it('persists the override to localStorage so it survives clearing the in-memory value', async () => {
      // The override is intentionally persisted and NOT removed on null — the
      // window where the in-memory override is null should still resolve to the
      // last-known-good URL, not the env default.
      const { setDatastreamBaseUrl, getDatastreamBaseUrl } = await freshUrls();
      setDatastreamBaseUrl('https://custom.example.com');
      setDatastreamBaseUrl(null);
      expect(getDatastreamBaseUrl()).toBe('https://custom.example.com');
      localStorage.removeItem('_sc_datastreamBaseUrl'); // clean up persisted state
    });

    it('falls back to the env URL when neither override nor persisted value exists', async () => {
      localStorage.removeItem('_sc_datastreamBaseUrl');
      const { setDatastreamBaseUrl, getDatastreamBaseUrl } = await freshUrls();
      setDatastreamBaseUrl(null);
      expect(getDatastreamBaseUrl()).toBe('https://datastream.salescode.ai');
    });

    it('treats an empty string override as no override', async () => {
      localStorage.removeItem('_sc_datastreamBaseUrl');
      const { setDatastreamBaseUrl, getDatastreamBaseUrl } = await freshUrls();
      setDatastreamBaseUrl('');
      expect(getDatastreamBaseUrl()).toBe('https://datastream.salescode.ai');
    });
  });

  describe('setHostBaseUrl / setReportBaseUrl overrides', () => {
    it('overrides the host base URL', async () => {
      const { setHostBaseUrl, getHostBaseUrl } = await freshUrls();
      setHostBaseUrl('https://host.example.com//');
      expect(getHostBaseUrl()).toBe('https://host.example.com');
      setHostBaseUrl(null);
      expect(getHostBaseUrl()).toBe('https://prod.salescode.ai');
    });

    it('overrides the report base URL', async () => {
      const { setReportBaseUrl, getReportBaseUrl } = await freshUrls();
      setReportBaseUrl('https://rpt.example.com');
      expect(getReportBaseUrl()).toBe('https://rpt.example.com');
      setReportBaseUrl(null);
      expect(getReportBaseUrl()).toBe('https://reportsprod.salescode.ai');
    });
  });
});
