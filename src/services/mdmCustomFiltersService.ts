import type { newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption } from './types';
import { fetchAvailableFilters } from './reportsDataService';

/**
 * Loads and processes custom filters for a given report config:
 * - Fetches available filters from the API
 * - Removes filtersToHide
 * - Removes merged filter aliases AND their source aliases
 * - Removes distributor_code ONLY when it is the active distributor field (it would
 *   then be driven by the TopFilterBar's Distributor dropdown, so showing it again
 *   as a custom filter would create two controls editing the same selection).
 *   Otherwise distributor_code is shown as a normal custom filter.
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

  // Hide distributor_code only if the TopFilterBar already owns it as the
  // distributor field (avoids a duplicate control for the same selection).
  const distributorFieldOwnsCode =
    reportConfig.distributorFilter?.enabled &&
    (reportConfig.distributorFilter?.field ?? 'distributor_code') === 'distributor_code';

  return allFilters.filter((f) => {
    if (f.alias === 'distributor_code' && distributorFieldOwnsCode) return false;
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

/**
 * True when the report config lists this filter alias in `singleSelectFilters`,
 * meaning the dropdown should allow only one option at a time.
 */
export function isSingleSelectFilterForReport(
  filterAlias: string,
  reportConfig: newReportConfig | null
): boolean {
  return Boolean(reportConfig?.singleSelectFilters?.includes(filterAlias));
}
