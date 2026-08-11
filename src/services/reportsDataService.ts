import { datastreamGet, datastreamPost } from './networkService';
import { applyCustomPayloadCommaSeparated, type CustomPayloadEntry } from '../types/mdmReportsUtils';
import type { FilterOption, ColumnOption, LiveReportDownloadRequest } from './types';

// ─── Sales Hierarchy ───────────────────────────────────────────────────────────

export async function fetchSalesDesignations(
  parentDesignation: string,
  scope?: string
): Promise<string[]> {
  const response = await datastreamGet('/org/users/designations/by-parent', {
    designation: parentDesignation,
    ...(scope ? { scope } : {}),
  });
  return response.data?.designations ?? response.data ?? [];
}

export async function fetchUsersByDesignation(
  designation: string
): Promise<{ userId: string; name: string; loginId: string }[]> {
  const response = await datastreamGet('/org/users/by-designation', { designation });
  return response.data?.users ?? response.data ?? [];
}

export async function fetchChildrenUsers(
  userId: string,
  designation: string
): Promise<{ userId: string; name: string; loginId: string }[]> {
  const response = await datastreamGet('/org/users/children', { userId, designation });
  return response.data?.users ?? response.data ?? [];
}

// ─── Geographical Hierarchy ────────────────────────────────────────────────────

export async function fetchGeographicalLevels(): Promise<string[]> {
  const response = await datastreamGet('/org/users/location/levels');
  return response.data?.levelsLowToHigh ?? response.data ?? [];
}

export async function fetchGeographicalLocations(
  level: string
): Promise<{ value: string; label: string }[]> {
  const response = await datastreamGet('/org/locations', { parentLevel: level });
  const locations: string[] = response.data?.locations ?? response.data ?? [];
  return locations.map(loc => ({ value: loc, label: loc }));
}

export async function fetchGeographicalLocationsUnder(
  parentLevel: string,
  parentValue: string,
  childLevel: string
): Promise<{ value: string; label: string }[]> {
  const response = await datastreamGet('/org/users/location/under', {
    parentLevel,
    parentValue,
    childLevel,
  });
  const values: string[] = response.data?.values ?? response.data ?? [];
  return values.map(v => ({ value: v, label: v }));
}

export async function fetchLocationUsers(
  level: string,
  value: string,
  designation?: string
): Promise<{ userId: string; loginId: string; name: string }[]> {
  const response = await datastreamGet('/org/users/location/users', {
    level,
    value,
    ...(designation ? { designation } : {}),
  });
  return response.data?.users ?? response.data ?? [];
}

// ─── Report Data ───────────────────────────────────────────────────────────────

export interface ReportSearchParams {
  report: string;
  page?: number;
  pageSize?: number;
  contains?: string;
  since?: string;
  until?: string;
  pf?: string;
  filters?: Record<string, string[]>;
  distributorFilter?: {
    locationFilters?: { level: string; value: string }[];
    userFilters?: { userId: string; direct: boolean }[];
  };
}

export async function fetchReportData(params: ReportSearchParams) {
  const { report, page, pageSize, contains, since, until, pf, filters, distributorFilter } =
    params;

  // Spread filter values as top-level keys, comma-separated rather than arrays
  const spreadFilters: Record<string, string> = {};
  if (filters) {
    for (const [key, values] of Object.entries(filters)) {
      spreadFilters[key] = values.join(',');
    }
  }

  const payload: Record<string, unknown> = {
    report,
    count: true,
    ...(page !== undefined ? { page } : {}),
    ...(pageSize !== undefined ? { pageSize } : { pageSize: 30 }),
    ...(contains ? { contains } : {}),
    ...(since ? { since } : {}),
    ...(until ? { until } : {}),
    ...(pf ? { pf } : {}),
    ...spreadFilters,
    ...(distributorFilter ? { distributorFilter } : {}),
  };

  const response = await datastreamPost('/rpt-generic/search', payload);
  return response.data;
}

// ─── Filter Values ─────────────────────────────────────────────────────────────

export interface FilterValuesParams {
  report: string;
  which: string;
  contains?: string;
  since?: string;
  until?: string;
  additionalFilters?: Record<string, string[]>;
  filters?: Record<string, string[]>;
  /** Hardcoded values sent comma-separated at top level (e.g. company: "britannia") */
  sendCustomPayload?: CustomPayloadEntry[];
  distributorFilter?: {
    locationFilters?: { level: string; value: string }[];
    userFilters?: { userId: string; direct: boolean }[];
  };
}

export async function fetchFilterValues(
  params: FilterValuesParams
): Promise<string[]> {
  const { report, which, contains, since, until, additionalFilters, filters, sendCustomPayload, distributorFilter } =
    params;

  const spreadFilters: Record<string, string | string[]> = {};

  // additionalFilters: distributor_code is comma-separated, everything else stays as-is
  if (additionalFilters) {
    for (const [key, values] of Object.entries(additionalFilters)) {
      if (values && values.length > 0) {
        spreadFilters[key] = key === 'distributor_code' ? values.join(',') : values;
      }
    }
  }

  // filters (custom-filter dependencies): ALWAYS sent comma-separated, never as arrays
  if (filters) {
    for (const [key, values] of Object.entries(filters)) {
      if (values && values.length > 0) {
        spreadFilters[key] = values.join(',');
      }
    }
  }

  // Hardcoded config values — comma-separated at top level
  applyCustomPayloadCommaSeparated(spreadFilters as Record<string, string>, sendCustomPayload);

  // Drop distributorFilter when a direct distributor_code selection is present
  const hasDirectDistributor =
    (filters?.distributor_code?.length ?? 0) > 0 ||
    (additionalFilters?.distributor_code?.length ?? 0) > 0;

  const payload: Record<string, unknown> = {
    report,
    which,
    ...(contains ? { contains } : {}),
    ...(since ? { since } : {}),
    ...(until ? { until } : {}),
    ...spreadFilters,
    ...(distributorFilter && !hasDirectDistributor ? { distributorFilter } : {}),
  };

  const response = await datastreamPost('/rpt-generic/filter-values', payload);
  return response.data?.values?.[which] ?? [];
}

// ─── Column / Filter Definitions ──────────────────────────────────────────────

/**
 * The `/report-defs/fields` response carries BOTH the filter defs
 * (`fields.filters.map`) and the column defs (`fields.columns`). Filters are
 * loaded by the filter screen and columns by the preview screen, so the endpoint
 * used to be hit twice per report. This memo dedupes by report name: concurrent
 * callers share one in-flight request, and repeat callers reuse the response.
 *
 * Keyed by report name; a rejected fetch is evicted so the next call retries.
 */
interface ReportFieldsData {
  fields?: {
    filters?: { map?: Record<string, FilterOption> };
    columns?: ColumnOption[];
  };
}

const reportFieldsCache = new Map<string, Promise<ReportFieldsData>>();

function fetchReportFields(reportName: string): Promise<ReportFieldsData> {
  const cached = reportFieldsCache.get(reportName);
  if (cached) return cached;

  const promise = datastreamGet('/report-defs/fields', { report: reportName })
    .then(response => response.data as ReportFieldsData)
    .catch(err => {
      reportFieldsCache.delete(reportName);
      throw err;
    });
  reportFieldsCache.set(reportName, promise);
  return promise;
}

export async function fetchAvailableFilters(reportName: string): Promise<FilterOption[]> {
  const data = await fetchReportFields(reportName);
  // API returns filters at data.fields.filters.map (object keyed by field1, field2, …)
  const filtersObj = data?.fields?.filters?.map;
  return filtersObj ? Object.values(filtersObj) : [];
}

export async function fetchColumnDefinitions(reportName: string): Promise<ColumnOption[]> {
  const data = await fetchReportFields(reportName);
  return data?.fields?.columns ?? [];
}

// ─── Downloads (async submit + poll) ──────────────────────────────────────────

export interface AsyncSubmitResponse {
  runId: string;
  config?: string;
  reports?: string[];
  startedAt?: string;
}

interface DistributorFilterPayload {
  locationFilters?: { level: string; value: string }[];
  userFilters?: { userId: string; direct: boolean }[];
}

export interface LiveReportPayload {
  configName: string;
  dateRange?: { startDate: string; endDate: string };
  period?: string;
  year?: string;
  filters?: { map?: Record<string, string[]>; pf?: string };
  distributorFilter?: DistributorFilterPayload;
  format: string;
  fullAllow?: boolean;
}

export interface SnapshotReportPayload {
  reportName: string;
  filters?: { map?: Record<string, string[]>; pf?: string };
  dateRange?: { startDate: string; endDate: string };
  format?: string;
  distributorFilter?: DistributorFilterPayload;
  fullAllow?: boolean;
}

async function submitAsync(path: string, payload: unknown): Promise<string> {
  try {
    const response = await datastreamPost(path, payload);
    const runId = response.data?.runId;
    if (!runId) throw new Error('Async submit did not return a runId');
    return runId;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
    if (axiosErr.response?.status === 429) {
      throw new Error(
        axiosErr.response.data?.error ??
          'Server busy, too many concurrent reports. Try again later.'
      );
    }
    throw err;
  }
}

export async function submitLiveReportAsync(params: LiveReportPayload): Promise<string> {
  return submitAsync('/live/download?attachment=false', params);
}

export async function submitSnapshotReportAsync(
  params: SnapshotReportPayload
): Promise<string> {
  return submitAsync('/rpt-generic/download?attachment=false', params);
}

interface PollAsyncReportOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

export async function pollAsyncReport(
  runId: string,
  options: PollAsyncReportOptions = {}
): Promise<Blob> {
  const { intervalMs = 5000, timeoutMs = 20 * 60 * 1000 } = options;
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Report generation timed out');
    }

    const response = await datastreamGet(
      '/reports/download',
      { runId },
      { responseType: 'blob', validateStatus: () => true }
    );

    if (response.status === 200) {
      return response.data as Blob;
    }

    // Non-200 statuses carry a JSON body but we requested blob — decode it.
    const blob = response.data as Blob | undefined;
    let body: { status?: string; message?: string } = {};
    if (blob && typeof blob.text === 'function') {
      try {
        const text = await blob.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    if (response.status === 202) {
      await new Promise(r => setTimeout(r, intervalMs));
      continue;
    }
    if (response.status === 422) {
      throw new Error(body.message ?? 'Report generation failed');
    }
    if (response.status === 404) {
      throw new Error(body.message ?? 'Unknown or expired runId');
    }
    throw new Error(body.message ?? `Unexpected status ${response.status}`);
  }
}
