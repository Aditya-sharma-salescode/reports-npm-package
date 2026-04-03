// Datastream API — report data, filters, hierarchy, downloads
const DATASTREAM_URLS: Record<string, string> = {
  prod: 'https://datastream.salescode.ai',
  demo: 'https://datastream-demo.salescode.ai',
  uat: 'https://datastream-saleshub-qa.salescodeai.com',
};

// Host API — task-based downloads (PDF/GSTR/Custom), distributor meta
const HOST_URLS: Record<string, string> = {
  prod: 'https://prod.salescode.ai',
  demo: 'https://demo.salescode.ai',
  uat: 'https://uat.salescode.ai',
};

// Report service — file download by key
const REPORT_URLS: Record<string, string> = {
  prod: 'https://reportsprod.salescode.ai',
  demo: 'https://reportsdemo.salescode.ai',
  uat: 'https://uat.salescode.ai',
};

const MARKETPLACE_URL = 'https://salescode-marketplace.salescode.ai';

/**
 * Derives environment from accountId stored in localStorage.
 * Contains "uat" → uat | contains "demo" → demo | else → prod
 */
export function getEnv(): string {
  const accountId = (localStorage.getItem('accountId') || '').toLowerCase();
  if (accountId.includes('uat')) return 'uat';
  if (accountId.includes('demo')) return 'demo';
  return 'prod';
}

let _datastreamBaseUrlOverride: string | null = null;

/** Set a custom datastream base URL (e.g. from report config's getAPI field) */
export function setDatastreamBaseUrl(url: string | null): void {
  _datastreamBaseUrlOverride = url?.replace(/\/+$/, '') || null;
}

export function getDatastreamBaseUrl(): string {
  return _datastreamBaseUrlOverride || DATASTREAM_URLS[getEnv()] || DATASTREAM_URLS.prod;
}

export function getMarketplaceBaseUrl(): string {
  return MARKETPLACE_URL;
}

export function getHostBaseUrl(): string {
  return HOST_URLS[getEnv()] ?? HOST_URLS.prod;
}

export function getReportBaseUrl(): string {
  return REPORT_URLS[getEnv()] ?? REPORT_URLS.prod;
}
