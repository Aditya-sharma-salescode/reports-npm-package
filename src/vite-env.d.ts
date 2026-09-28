/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Environment suffix appended to the runtime tenant for the marketplace
   * /configuration/fetch call only (e.g. "-prod" → "zydus" becomes "zydus-prod").
   * Set per-environment by the standalone app build (see codemagic.yaml).
   * Unset in the npm-library build and dev → no suffix (unchanged behavior).
   */
  readonly VITE_CONFIG_TENANT_SUFFIX?: string;
  /** Feature Usage Report API base URL; defaults to the dev Tracebit API. */
  readonly VITE_FEATURE_REPORT_API_BASE_URL?: string;
  /** Feature Usage Report API key; defaults to the built-in key. */
  readonly VITE_FEATURE_REPORT_API_KEY?: string;
  /** Local dev only: tenant written to localStorage.accountId when no cookie/value exists. */
  readonly VITE_TENANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
