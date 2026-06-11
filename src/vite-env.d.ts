/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Environment suffix appended to the runtime tenant for the marketplace
   * /configuration/fetch call only (e.g. "-prod" → "zydus" becomes "zydus-prod").
   * Set per-environment by the standalone app build (see codemagic.yaml).
   * Unset in the npm-library build and dev → no suffix (unchanged behavior).
   */
  readonly VITE_CONFIG_TENANT_SUFFIX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
