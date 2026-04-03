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
 * Fetches report configurations from the marketplace config API.
 * Looks for domainName='clientconfig' and domainType='distributor_report_configuration'.
 * domainValues is directly the array of report config objects.
 */
export async function fetchReportConfigs(): Promise<newReportConfig[]> {
  const lob = getTenantId();
  if (!lob) return [];

  const url = `${getMarketplaceBaseUrl()}/configuration/fetch`;
  const response = await axios.get<MarketplaceResponse>(url, {
    headers: { lob },
  });

  const features = response.data?.features ?? [];
  const configFeature = features.find(
    f => f.domainName === 'clientconfig' && f.domainType === 'distributor_report_configuration'
  );

  if (!configFeature?.domainValues?.length) return [];

  return configFeature.domainValues as newReportConfig[];
}
