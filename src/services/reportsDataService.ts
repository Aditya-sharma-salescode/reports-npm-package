import { datastreamGet, datastreamPost } from './networkService';
import type { FilterOption, ColumnOption } from './types';

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

  // Spread filter values as top-level keys
  const spreadFilters: Record<string, string | string[]> = {};
  if (filters) {
    for (const [key, values] of Object.entries(filters)) {
      if (key === 'distributor_code') {
        spreadFilters[key] = values.join(',');
      } else {
        spreadFilters[key] = values;
      }
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
  distributorFilter?: {
    locationFilters?: { level: string; value: string }[];
    userFilters?: { userId: string; direct: boolean }[];
  };
}

export async function fetchFilterValues(
  params: FilterValuesParams
): Promise<string[]> {
  const { report, which, contains, since, until, additionalFilters, filters, distributorFilter } =
    params;

  const spreadFilters: Record<string, string | string[]> = {};
  const allFilters = { ...additionalFilters, ...filters };
  for (const [key, values] of Object.entries(allFilters)) {
    if (key === 'distributor_code') {
      spreadFilters[key] = values.join(',');
    } else {
      spreadFilters[key] = values;
    }
  }

  const payload: Record<string, unknown> = {
    report,
    which,
    ...(contains ? { contains } : {}),
    ...(since ? { since } : {}),
    ...(until ? { until } : {}),
    ...spreadFilters,
    ...(distributorFilter ? { distributorFilter } : {}),
  };

  const response = await datastreamPost('/rpt-generic/filter-values', payload);
  return response.data?.values?.[which] ?? [];
}

// ─── Column / Filter Definitions ──────────────────────────────────────────────

export async function fetchAvailableFilters(reportName: string): Promise<FilterOption[]> {
  const response = await datastreamGet('/report-defs/fields', { report: reportName });
  return response.data?.filters ?? [];
}

export async function fetchColumnDefinitions(reportName: string): Promise<ColumnOption[]> {
  const response = await datastreamGet('/report-defs/fields', { report: reportName });
  return response.data?.columns ?? [];
}

// ─── Downloads ─────────────────────────────────────────────────────────────────

export async function downloadSnapshotReport(params: {
  reportName: string;
  filters?: { map?: Record<string, string[]>; pf?: string };
  dateRange?: { startDate: string; endDate: string };
  format?: string;
  distributorFilter?: {
    locationFilters?: { level: string; value: string }[];
    userFilters?: { userId: string; direct: boolean }[];
  };
}): Promise<Blob> {
  const response = await datastreamPost('/rpt-generic/download', params, 'blob');
  return response.data as Blob;
}

export async function downloadLiveReport(params: {
  configName: string;
  dateRange?: { startDate: string; endDate: string };
  period?: string;
  year?: string;
  filters?: { map?: Record<string, string[]>; pf?: string };
  distributorFilter?: {
    locationFilters?: { level: string; value: string }[];
    userFilters?: { userId: string; direct: boolean }[];
  };
  format: string;
}): Promise<Blob> {
  const response = await datastreamPost('/live/download?attachment=true', params, 'blob');
  return response.data as Blob;
}
