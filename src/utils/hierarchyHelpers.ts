import type { DrillDownPathItem, PathSummaryItem } from '../services/types';

/**
 * Summarizes a drill-down path by grouping consecutive items at the same level.
 * Useful for displaying "3 RSMs selected" instead of listing each individually.
 */
export function summarizeDrillDownPath(path: DrillDownPathItem[]): PathSummaryItem[] {
  const result: PathSummaryItem[] = [];
  let i = 0;

  while (i < path.length) {
    const level = path[i].level;
    let count = 0;
    const startIndex = i;
    const firstValue = path[i].value;

    while (i < path.length && path[i].level === level) {
      count++;
      i++;
    }

    result.push({ level, count, startIndex, firstValue });
  }

  return result;
}

export function transformApiResponseToFilterOptions(
  apiResponse: unknown,
  valueKey = 'value',
  labelKey = 'label'
): { value: unknown; label: unknown }[] {
  if (!Array.isArray(apiResponse)) return [];
  return apiResponse.map((item: Record<string, unknown>) => ({
    value: item[valueKey],
    label: item[labelKey],
  }));
}
