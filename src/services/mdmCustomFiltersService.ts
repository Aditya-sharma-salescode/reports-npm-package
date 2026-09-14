import type { newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption } from './types';
import { fetchAvailableFilters } from './reportsDataService';
import { NEW_DIST_FILTER_ALIAS } from './distributorMetaService';

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

  // Hide distributor_code only when the TopFilterBar's Distributor dropdown is
  // actually rendered and owns it (avoids a duplicate control for the same
  // selection). In isDistributorView the TopFilterBar is hidden entirely, so
  // nothing owns distributor_code there — show it as a custom filter instead.
  // With newDistFilter the TopFilterBar's dropdown is hidden and the custom
  // filter owns distributor_code instead, so it must not be stripped here.
  const distributorFieldOwnsCode =
    reportConfig.distributorFilter?.enabled &&
    !reportConfig.isDistributorView &&
    !reportConfig.newDistFilter &&
    (reportConfig.distributorFilter?.field ?? 'distributor_code') === 'distributor_code';

  const visible = allFilters.filter((f) => {
    if (f.alias === 'distributor_code' && distributorFieldOwnsCode) return false;
    if (filtersToHide.has(f.alias)) return false;
    if (mergedFilterAliases.has(f.alias)) return false;
    if (mergedSourceAliases.has(f.alias)) return false;
    return true;
  });

  // newDistFilter reports get a Distributor dropdown backed by the host
  // /distributors endpoint instead of the report's own filter values. It may not
  // be present in allFilters at all, so add it when missing; when it IS present
  // we keep the API's display label and just let the new loader own its options.
  if (reportConfig.newDistFilter && !filtersToHide.has(NEW_DIST_FILTER_ALIAS)) {
    const exists = visible.some((f) => f.alias === NEW_DIST_FILTER_ALIAS);
    if (!exists) {
      visible.unshift({ alias: NEW_DIST_FILTER_ALIAS, display: 'Distributor' });
    }
  }

  return visible;
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
  // The newDistFilter distributor dropdown is single-select by definition
  // (EMAMI-2054), so it doesn't need to be repeated in singleSelectFilters.
  if (reportConfig?.newDistFilter && filterAlias === NEW_DIST_FILTER_ALIAS) return true;
  return Boolean(reportConfig?.singleSelectFilters?.includes(filterAlias));
}

/** True when this alias's options come from the host /distributors endpoint. */
export function isNewDistFilter(
  filterAlias: string,
  reportConfig: newReportConfig | null
): boolean {
  return Boolean(reportConfig?.newDistFilter) && filterAlias === NEW_DIST_FILTER_ALIAS;
}
