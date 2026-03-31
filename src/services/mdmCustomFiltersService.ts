import type { newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption } from './types';
import { fetchAvailableFilters } from './reportsDataService';

const GLOBAL_FILTERS = ['distributor_code'];

/**
 * Loads and processes custom filters for a given report config:
 * - Fetches available filters from the API
 * - Removes filtersToHide
 * - Removes global filters (distributor_code)
 * - Removes merged filter aliases AND their source aliases
 */
export async function loadCustomFiltersForReport(
  reportConfig: newReportConfig | null
): Promise<FilterOption[]> {
  if (!reportConfig) return [];

  const reportName = reportConfig.filterReportName ?? reportConfig.reportName;
  const allFilters = await fetchAvailableFilters(reportName);

  const filtersToHide = new Set(reportConfig.filtersToHide ?? []);
  const mergedFilterAliases = new Set(Object.keys(reportConfig.mergedFilters ?? {}));

  // Collect all source aliases from merged filters
  const mergedSourceAliases = new Set<string>();
  for (const sources of Object.values(reportConfig.mergedFilters ?? {})) {
    for (const src of sources) {
      mergedSourceAliases.add(src.alias);
    }
  }

  return allFilters.filter((f) => {
    if (GLOBAL_FILTERS.includes(f.alias)) return false;
    if (filtersToHide.has(f.alias)) return false;
    if (mergedFilterAliases.has(f.alias)) return false;
    if (mergedSourceAliases.has(f.alias)) return false;
    return true;
  });
}

export function isMergedFilterForReport(
  filterAlias: string,
  reportConfig: newReportConfig | null
): boolean {
  return Boolean(reportConfig?.mergedFilters?.[filterAlias]);
}

export function getMergedFilterSources(
  filterAlias: string,
  reportConfig: newReportConfig | null
) {
  return reportConfig?.mergedFilters?.[filterAlias] ?? [];
}
