// ─── Main component ────────────────────────────────────────────────────────────
export { ReportsApp, FEATURE_USAGE_REPORT_ID } from './ReportsApp';
export { FeatureUsageReport } from './screens/FeatureUsageReport';
export { downloadFeatureUsageReport, NotAuthenticatedError } from './services/featureUsageReportService';
export type { FeatureUsageReportRequest } from './services/featureUsageReportService';

// ─── Public types (host app needs these to construct reportCards config) ────────
export type {
  newReportConfig,
  ReportColumnConfig,
  ReportTableConfiguration,
  SalesHierarchyFilter,
  GeographicalHierarchyFilter,
  DistributorFilterConfig,
  MergedFilterSource,
  FilterConfig,
  DateRangeOption,
  MdmReportsConfig,
  DateRangeAllowed,
  DateRangeAllowedUnit,
} from './types/mdmReportsUtils';

// ─── Utility functions (optional, for host app convenience) ─────────────────────
export {
  parseDateRangeAllowed,
  getDateRangeFromAllowed,
  getLabelFromAllowed,
  getMaxDateFromCustomRange,
} from './types/mdmReportsUtils';

// ─── Config helpers (env detection, URL resolvers) ──────────────────────────────
export { getEnv, getDatastreamBaseUrl, setDatastreamBaseUrl, getHostBaseUrl, setHostBaseUrl, getReportBaseUrl, setReportBaseUrl, getFeatureUsageReportBaseUrl, setFeatureUsageReportBaseUrl } from './config/urls';
export { fetchReportConfigs, getReportConfigDomainType, DISTRIBUTOR_REPORT_CONFIG, ADMIN_REPORT_CONFIG } from './services/configService';
export { getAccessToken, getTenantId, getOrgType, getAuthContext, syncAuthFromCookies } from './config/auth';
