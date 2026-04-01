import dayjs, { type Dayjs } from 'dayjs';
import { downloadLiveReport, downloadSnapshotReport, fetchLocationUsers, fetchChildrenUsers } from './reportsDataService';
import { hostGet, hostPost, fetchAndDownloadReport } from './networkService';
import { getAuthContext, getTenantId } from '../config/auth';
import type { DownloadParams, DrillDownPathItem, DistributorFeature } from './types';

// ─── Date conversion helpers ───────────────────────────────────────────────────

function toUtcDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function convertDayjsStartDateToUtcString(date: Dayjs): string {
  const localStart = new Date(date.year(), date.month(), date.date(), 0, 0, 0);
  return toUtcDateString(localStart);
}

function convertDayjsEndDateToUtcString(date: Dayjs): string {
  const localEnd = new Date(date.year(), date.month(), date.date(), 23, 59, 59);
  return toUtcDateString(localEnd);
}

// ─── Browser download trigger ──────────────────────────────────────────────────

function triggerBrowserDownload(blob: Blob, reportName: string, format: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportName}_${dayjs().format('YYYY-MM-DD')}.${format.toLowerCase()}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ─── Task-based download polling ───────────────────────────────────────────────

async function pollTaskAndDownload(taskId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await hostGet(`/tasks/${taskId}`);
        const feature = response.data?.features?.[0];
        const status: string = (feature?.status ?? '').toLowerCase();
        const fileKeys: string[] = feature?.attributes?.fileKeys ?? [];

        if (status === 'success') {
          clearInterval(interval);
          for (const fileKey of fileKeys) {
            await fetchAndDownloadReport(fileKey);
          }
          resolve();
        } else if (status === 'failure') {
          clearInterval(interval);
          reject(new Error('Report generation failed'));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 1000);
  });
}

// ─── Filter / location / user builders ────────────────────────────────────────

export function buildLocationFilters(
  geoDrillDownPath: DrillDownPathItem[]
): { level: string; value: string }[] {
  const map = new Map<string, string>();
  for (const item of geoDrillDownPath) {
    map.set(item.level, item.value);
  }
  return Array.from(map.entries()).map(([level, value]) => ({ level, value }));
}

export function buildUserFilters(
  salesDrillDownPath: DrillDownPathItem[],
  hierarchyOrder: string[]
): { userId: string; direct: boolean }[] {
  const supplierLevel = hierarchyOrder[hierarchyOrder.length - 1];
  return salesDrillDownPath.map((item) => ({
    userId: item.value,
    direct: item.level === supplierLevel,
  }));
}

async function collectDistributorCodes(params: DownloadParams): Promise<string[]> {
  const { selectedReport, filters, primaryFilter, salesDrillDownPath, geoDrillDownPath } = params;
  const { loginId } = getAuthContext();

  // No primary filter set — fall back to direct distributor selection or logged-in user
  if (!primaryFilter) {
    const directCodes = filters['distributor_code'] ?? [];
    if (directCodes.length > 0) return directCodes;
    if (selectedReport.isDistributorView && loginId) return [loginId];
    return [];
  }

  if (primaryFilter === 'distributor') {
    return filters['distributor_code'] ?? [];
  }

  if (primaryFilter === 'sales' && salesDrillDownPath && salesDrillDownPath.length > 0) {
    const hierarchyOrder = selectedReport.salesHierarchyFilter?.hierarchyOrder ?? [];
    const supplierLevel = hierarchyOrder[hierarchyOrder.length - 1];
    const deepest = salesDrillDownPath[salesDrillDownPath.length - 1];
    if (!deepest) return [];

    if (deepest.level === supplierLevel) {
      return [deepest.value];
    }

    // Fetch children at supplier level
    const children = await fetchChildrenUsers(deepest.value, supplierLevel);
    return children.map((u) => u.loginId);
  }

  if (primaryFilter === 'geographical' && geoDrillDownPath && geoDrillDownPath.length > 0) {
    const deepest = geoDrillDownPath[geoDrillDownPath.length - 1];
    if (!deepest) return [];
    const users = await fetchLocationUsers(deepest.level, deepest.value, 'supplier');
    return users.map((u) => u.loginId);
  }

  return [];
}

function buildFiltersMap(
  params: DownloadParams,
  distributorCodes: string[]
): Record<string, string[]> {
  const { selectedReport, filters } = params;
  const map: Record<string, string[]> = {};

  if (distributorCodes.length > 0) {
    map['distributor_code'] = distributorCodes;
  }

  const hierarchyLevelKeys = new Set([
    selectedReport.salesHierarchyFilter?.levelFilterField,
    selectedReport.salesHierarchyFilter?.valueFilterField,
    selectedReport.geographicalHierarchyFilter?.levelFilterField,
    selectedReport.geographicalHierarchyFilter?.valueFilterField,
  ]);

  const mergedSourceAliases = new Set<string>();
  for (const sources of Object.values(selectedReport.mergedFilters ?? {})) {
    for (const src of sources) {
      mergedSourceAliases.add(src.alias);
    }
  }

  for (const [key, values] of Object.entries(filters)) {
    if (key === 'distributor_code') continue;
    if (hierarchyLevelKeys.has(key)) continue;
    if (mergedSourceAliases.has(key)) continue;
    if (values.length > 0) {
      map[key] = values;
    }
  }

  return map;
}

// ─── Main download orchestrator ────────────────────────────────────────────────

export async function downloadReport(params: DownloadParams): Promise<void> {
  const { selectedReport, dateRangeType, fromDate, toDate, period, year, format } = params;
  const { loginId } = getAuthContext();
  const lob = getTenantId();

  const startDate = convertDayjsStartDateToUtcString(fromDate);
  const endDate = convertDayjsEndDateToUtcString(toDate);

  const distributorCodes = await collectDistributorCodes(params);
  const filtersMap = buildFiltersMap(params, distributorCodes);

  // Build distributor filter for hierarchy-based filtering (when no direct distributor_code)
  const useHierarchyDistributorFilter =
    (params.primaryFilter === 'sales' || params.primaryFilter === 'geographical') &&
    distributorCodes.length === 0;

  const locationFilters =
    params.geoDrillDownPath && params.geoDrillDownPath.length > 0
      ? buildLocationFilters(params.geoDrillDownPath)
      : undefined;

  const hierarchyOrder = selectedReport.salesHierarchyFilter?.hierarchyOrder ?? [];
  const userFilters =
    params.salesDrillDownPath && params.salesDrillDownPath.length > 0
      ? buildUserFilters(params.salesDrillDownPath, hierarchyOrder)
      : undefined;

  const distributorFilter =
    useHierarchyDistributorFilter && (locationFilters?.length || userFilters?.length)
      ? {
          ...(locationFilters?.length ? { locationFilters } : {}),
          ...(userFilters?.length ? { userFilters } : {}),
        }
      : undefined;

  // ── Live report ──────────────────────────────────────────────────────────────
  if (selectedReport.isLiveReport) {
    const blob = await downloadLiveReport({
      configName: selectedReport.reportName,
      dateRange:
        dateRangeType === 'daterange'
          ? { startDate, endDate }
          : undefined,
      period: dateRangeType === 'period' ? period : undefined,
      year: dateRangeType === 'period' ? year : undefined,
      filters: {
        map: filtersMap,
        ...(params.pf ? { pf: params.pf } : {}),
      },
      ...(distributorFilter ? { distributorFilter } : {}),
      format,
    });
    triggerBrowserDownload(blob, selectedReport.reportName, format);
    return;
  }

  // ── PDF report ───────────────────────────────────────────────────────────────
  if (selectedReport.isPDFReport) {
    const payload = {
      attributes: {
        name: selectedReport.reportName,
        format,
        loggedInUserName: loginId,
        fromDate: startDate,
        toDate: endDate,
        filters: { map: filtersMap },
      },
      lob,
    };
    const response = await hostPost('/tasks/types/batchInvoicePdf/execute', payload);
    const taskId: string = response.data?.features?.[0]?.id;
    if (!taskId) throw new Error('Task ID not returned');
    await pollTaskAndDownload(taskId);
    return;
  }

  // ── GSTR report ──────────────────────────────────────────────────────────────
  if (selectedReport.isGSTRReport) {
    const payload = {
      attributes: {
        name: selectedReport.reportName,
        format,
        loggedInUserName: loginId,
        fromDate: startDate,
        toDate: endDate,
      },
      lob,
    };
    const response = await hostPost(
      '/tasks/types/ExcelerExecutor/execute?source=portal',
      payload
    );
    const taskId: string = response.data?.features?.[0]?.id;
    if (!taskId) throw new Error('Task ID not returned');
    await pollTaskAndDownload(taskId);
    return;
  }

  // ── Custom download ──────────────────────────────────────────────────────────
  if (selectedReport.customDownload) {
    const metadata: Record<string, string> = {};
    if (selectedReport.sendMetadata && selectedReport.metadataFields) {
      for (const field of selectedReport.metadataFields) {
        if (params.optionsMap?.[field]) {
          metadata[field] = params.optionsMap[field]
            .map((o) => o.value)
            .join(',');
        }
      }
    }

    const payload = {
      attributes: {
        name: selectedReport.reportName,
        format,
        filters: { map: filtersMap },
        fromDate: startDate,
        toDate: endDate,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      },
      lob,
    };
    const response = await hostPost(
      '/tasks/types/ExcelerExecutor/execute?source=portal',
      payload
    );
    const taskId: string = response.data?.features?.[0]?.id;
    if (!taskId) throw new Error('Task ID not returned');
    await pollTaskAndDownload(taskId);
    return;
  }

  // ── Snapshot report (default) ─────────────────────────────────────────────────
  const blob = await downloadSnapshotReport({
    reportName: selectedReport.reportName,
    filters: {
      map: filtersMap,
      ...(params.pf ? { pf: params.pf } : {}),
    },
    dateRange: { startDate, endDate },
    format,
    ...(distributorFilter ? { distributorFilter } : {}),
  });
  triggerBrowserDownload(blob, selectedReport.reportName, format);
}
