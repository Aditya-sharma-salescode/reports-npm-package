import axios from 'axios';
import { getMarketplaceBaseUrl } from '../config/urls';
import { getOrgType, getTenantId } from '../config/auth';
import type { newReportConfig } from '../types/mdmReportsUtils';

interface MarketplaceFeature {
  domainName: string;
  domainType: string;
  domainValues: unknown[];
}

interface MarketplaceResponse {
  features: MarketplaceFeature[];
}

/**
 * Build-time environment suffix appended to the runtime tenant for the
 * config-fetch API only.
 *
 * The parent portal sets the same ACCOUNT_ID (e.g. "zydus") across environments,
 * so the runtime tenant alone can't tell one config bucket from another. The
 * standalone app is built per-environment (codemagic ENVIRONMENT), so each build
 * sets VITE_CONFIG_TENANT_SUFFIX and any tenant "zydus" becomes "zydus<suffix>":
 *   PROD  → "-prod"  ("zydus-prod")
 *   DEMO  → "-stg"   ("zydus-stg")   // staging
 *   UAT   → ""       ("zydus")
 * This is tenant-agnostic — the tenant name itself stays runtime-derived from the
 * cookie, nothing tenant-specific is baked into the build.
 *
 * Empty for UAT and in the npm-library build → unchanged behavior.
 */
const CONFIG_TENANT_SUFFIX = (import.meta.env.VITE_CONFIG_TENANT_SUFFIX ?? '').trim();

/** Org types that read the distributor report set. */
const DISTRIBUTOR_ORG_TYPES = ['distributor', 'supplier'];

export const DISTRIBUTOR_REPORT_CONFIG = 'distributor_report_configuration';
export const ADMIN_REPORT_CONFIG = 'admin_report_configuration';

/**
 * Marketplace `domainType` holding the report configs for a given org type.
 *
 * Reports are configured per org type, so a distributor and an admin user on the
 * same tenant get different report sets out of the same marketplace response.
 * Distributor-tier sessions (DISTRIBUTOR, and SUPPLIER which is the same tier
 * under another name) read the distributor set; everything else, including a
 * session with no org type at all, reads the admin set.
 *
 * The mapping is an explicit allowlist rather than a key derived from the org
 * type, so a new or unexpected org type lands on the admin set instead of
 * silently requesting a bucket the marketplace has never heard of.
 */
export function getReportConfigDomainType(orgType = getOrgType()): string {
  const normalized = orgType.trim().toLowerCase();
  return DISTRIBUTOR_ORG_TYPES.includes(normalized)
    ? DISTRIBUTOR_REPORT_CONFIG
    : ADMIN_REPORT_CONFIG;
}

/**
 * Fetches report configurations from the marketplace config API.
 * Looks for domainName='clientconfig' and the domainType matching this
 * session's org type (see `getReportConfigDomainType`).
 * domainValues is directly the array of report config objects.
 */
export async function fetchReportConfigs(): Promise<newReportConfig[]> {
  const tenant = getTenantId();
  if (!tenant) return [];
  const lob = tenant + CONFIG_TENANT_SUFFIX;

  const url = `${getMarketplaceBaseUrl()}/configuration/fetch`;
  // Marketplace responds with Access-Control-Allow-Origin: *, which is incompatible
  // with the global withCredentials=true default. Disable credentials on this call.
  const response = await axios.get<MarketplaceResponse>(url, {
    headers: { lob },
    withCredentials: false,
  });

  const features = response.data?.features ?? [];
  const domainType = getReportConfigDomainType();
  const configFeature = features.find(
    f => f.domainName === 'clientconfig' && f.domainType === domainType
  );

  if (!configFeature?.domainValues?.length) return [];

  return configFeature.domainValues as newReportConfig[];
}
