import axios from 'axios';
import { getMarketplaceBaseUrl } from '../config/urls';
import { getTenantId } from '../config/auth';
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
 * The parent portal sets the same ACCOUNT_ID (e.g. "zydus") on both staging and
 * prod, so the runtime tenant alone can't tell the prod config bucket from the
 * staging one. The standalone app is built per-environment (codemagic
 * ENVIRONMENT), so the PROD build sets VITE_CONFIG_TENANT_SUFFIX="-prod" and any
 * tenant "zydus" becomes "zydus-prod". This is tenant-agnostic — the tenant name
 * itself stays runtime-derived from the cookie, nothing tenant-specific is baked
 * into the build.
 *
 * Empty in staging/uat/demo and in the npm-library build → unchanged behavior.
 */
const CONFIG_TENANT_SUFFIX = (import.meta.env.VITE_CONFIG_TENANT_SUFFIX ?? '').trim();

/**
 * Fetches report configurations from the marketplace config API.
 * Looks for domainName='clientconfig' and domainType='distributor_report_configuration'.
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
  const configFeature = features.find(
    f => f.domainName === 'clientconfig' && f.domainType === 'distributor_report_configuration'
  );

  if (!configFeature?.domainValues?.length) return [];

  return configFeature.domainValues as newReportConfig[];
}
