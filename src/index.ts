// ─── Main component ────────────────────────────────────────────────────────────
export { ReportsApp } from './ReportsApp';

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
export { getEnv, getDatastreamBaseUrl, setDatastreamBaseUrl, getHostBaseUrl, getReportBaseUrl } from './config/urls';
export { fetchReportConfigs } from './services/configService';
export { getAccessToken, getTenantId, getAuthContext } from './config/auth';
