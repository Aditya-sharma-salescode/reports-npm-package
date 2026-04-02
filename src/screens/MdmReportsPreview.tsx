import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Dayjs } from 'dayjs';
import { fetchReportData, fetchColumnDefinitions, type ReportSearchParams } from '../services/reportsDataService';
import { isMergedFilterForReport, getMergedFilterSources } from '../services/mdmCustomFiltersService';
import { buildLocationFilters, buildUserFilters } from '../services/mdmReportsDownloadService';
import type { newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption, DrillDownPathItem, ColumnOption } from '../services/types';
import './MdmReportsPreview.css';

const PAGE_SIZE = 30;

interface MdmReportsPreviewProps {
  reportConfig: newReportConfig;
  filters: Record<string, string[]>;
  fromDate: Dayjs;
  toDate: Dayjs;
  salesDrillDownPath: DrillDownPathItem[];
  geoDrillDownPath: DrillDownPathItem[];
  primaryFilter: 'sales' | 'geographical' | 'distributor' | null;
  customFilters: FilterOption[];
  showPreview?: boolean;
  noPreviewText?: string;
  isNoPreviewReport?: boolean;
}

export function MdmReportsPreview({
  reportConfig,
  filters,
  fromDate,
  toDate,
  salesDrillDownPath,
  geoDrillDownPath,
  customFilters,
  showPreview = true,
  noPreviewText = 'Select filters to generate report',
  isNoPreviewReport = false,
}: MdmReportsPreviewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const lastRequestIdRef = useRef(0);
  const pageRowCountsRef = useRef<Record<number, number>>({});

  // Load column definitions once
  useEffect(() => {
    fetchColumnDefinitions(reportConfig.filterReportName ?? reportConfig.reportName)
      .then((cols) => {
        setColumns(cols);
      })
      .catch(console.error);
  }, [reportConfig]);

  // Reset page on filter/date change
  useEffect(() => {
    setPage(1);
    pageRowCountsRef.current = {};
  }, [filters, fromDate, toDate, salesDrillDownPath, geoDrillDownPath]);

  const loadData = useCallback(
    async (p: number) => {
      if (!reportConfig?.reportName) return;
      // Don't fetch for live/PDF/GSTR/custom-download reports, or when preview is not shown
      if (isNoPreviewReport || !showPreview) {
        setLoading(false);
        return;
      }

      const requestId = ++lastRequestIdRef.current;
      setLoading(true);

      try {
        const hierarchyOrder = reportConfig.salesHierarchyFilter?.hierarchyOrder || [];
        const supplierLevel = hierarchyOrder[hierarchyOrder.length - 1] || 'supplier';
        const distributorFilterField = reportConfig.distributorFilter?.field || 'distributor_code';

        const apiFilters: Record<string, string[]> = {};
        const levelKeys = [
          reportConfig.salesHierarchyFilter?.levelFilterField,
          reportConfig.geographicalHierarchyFilter?.levelFilterField,
        ].filter(Boolean) as string[];

        let distributorCodesFound = false;
        if (filters[distributorFilterField]?.length > 0) {
          apiFilters.distributor_code = filters[distributorFilterField];
          distributorCodesFound = true;
        }
        if (!distributorCodesFound && filters[supplierLevel]?.length > 0) {
          apiFilters.distributor_code = filters[supplierLevel];
          distributorCodesFound = true;
        }

        Object.entries(filters).forEach(([key, values]) => {
          if (levelKeys.includes(key)) return;
          if (key === supplierLevel || key === distributorFilterField) return;
          if (key === 'product_status' || key === 'batch_status' || key === 'distributor_status') return;
          if (isMergedFilterForReport(key, reportConfig)) return;
          if (key.endsWith('_dynamic')) {
            const mergedAlias = key.replace('_dynamic', '');
            if (isMergedFilterForReport(mergedAlias, reportConfig)) {
              const mergedSelections = filters[mergedAlias] || [];
              if (mergedSelections.length > 0) {
                const mergedSources = getMergedFilterSources(mergedAlias, reportConfig);
                const source = mergedSources?.find(s => s.value === mergedSelections[0]);
                if (source?.alias && values?.length > 0 && values[0] !== '') {
                  apiFilters[source.alias] = values;
                }
              }
              return;
            }
          }
          if (values?.length > 0 && values[0] !== '') {
            apiFilters[key] = values;
          }
        });

        const locationFilters = buildLocationFilters(geoDrillDownPath);
        const userFilters = buildUserFilters(
          salesDrillDownPath,
          reportConfig.salesHierarchyFilter?.hierarchyOrder || []
        );

        const hasDrillDownPaths = locationFilters.length > 0 || userFilters.length > 0;
        const hasDistributorCodes = apiFilters.distributor_code?.length > 0;

        if (!hasDrillDownPaths && !hasDistributorCodes) {
          if (requestId === lastRequestIdRef.current) {
            setRows([]);
            setHasMore(false);
            setTotal(0);
            setLoading(false);
          }
          return;
        }

        const distributorFilterPayload =
          hasDrillDownPaths
            ? {
                locationFilters: locationFilters.length > 0 ? locationFilters : undefined,
                userFilters: userFilters.length > 0 ? userFilters : undefined,
              }
            : undefined;

        const commaSeparatedFilters = Array.from(
          new Set(['distributor_code', ...customFilters.map(f => f.alias)])
        );

        const requestParams: ReportSearchParams & Record<string, unknown> = {
          getAPI: reportConfig.getAPI,
          report: reportConfig.reportName,
          page: p,
          pageSize: PAGE_SIZE,
          filters: Object.keys(apiFilters).length > 0 ? apiFilters : undefined,
          commaSeparatedFilters,
          distributorFilter: distributorFilterPayload,
        };

        if (reportConfig.dateRangeFilter) {
          const fromISO = new Date(Date.UTC(
            fromDate.year(), fromDate.month(), fromDate.date() - 1, 18, 30, 0
          )).toISOString().replace(/\.\d{3}Z$/, 'Z');
          const toISO = new Date(Date.UTC(
            toDate.year(), toDate.month(), toDate.date(), 18, 29, 59
          )).toISOString().replace(/\.\d{3}Z$/, 'Z');
          requestParams.since = fromISO;
          requestParams.until = toISO;
        }

        const data = await fetchReportData(requestParams);

        if (requestId === lastRequestIdRef.current) {
          const items = data?.items ?? data?.data ?? [];
          setRows(items);
          setTotal(data?.total ?? 0);
          setHasMore((data?.total ?? 0) > p * PAGE_SIZE && p < (data?.totalPages ?? 1));
          pageRowCountsRef.current[p] = items.length;
        }
      } catch (err) {
        if (requestId === lastRequestIdRef.current) {
          console.error('Failed to load report data:', err);
          setRows([]);
          setHasMore(false);
        }
      } finally {
        if (requestId === lastRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [reportConfig, fromDate, toDate, filters, salesDrillDownPath, geoDrillDownPath, customFilters, showPreview, isNoPreviewReport]
  );

  useEffect(() => {
    loadData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  useEffect(() => {
    loadData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const displayColumns: { alias: string; label: string }[] =
    columns.length > 0
      ? columns
          .filter(c => !(reportConfig.columnsToHide || []).includes(c.alias))
          .map((c) => ({ alias: c.alias, label: c.display || c.alias }))
      : rows.length > 0
      ? Object.keys(rows[0])
          .filter(k => k !== '@filters' && !(reportConfig.columnsToHide || []).includes(k))
          .map((k) => ({ alias: k, label: k }))
      : [];

  // Pagination display: X-Y of Z
  const { start, end } = useMemo(() => {
    const rowCount = loading
      ? (pageRowCountsRef.current[page] ?? PAGE_SIZE)
      : rows.length;
    if (rowCount === 0) return { start: 0, end: 0 };
    return {
      start: (page - 1) * PAGE_SIZE + 1,
      end: (page - 1) * PAGE_SIZE + rowCount,
    };
  }, [page, rows.length, loading]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fileIcon = (
    <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );

  // Not showing preview — show empty/no-preview state
  if (!showPreview) {
    return (
      <div className="sc-preview-container">
        <div className="sc-preview-empty-state-full">
          <div className="sc-preview-empty-icon">{fileIcon}</div>
          <h5 className="sc-preview-empty-title">
            {isNoPreviewReport ? noPreviewText : 'Select filters to generate report'}
          </h5>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-preview-container">
      {/* Data Table */}
      <div className="sc-preview-table-container">
        {loading ? (
          <div className="sc-preview-loading-state">
            <div className="sc-preview-spinner" />
            <div className="sc-preview-loading-text">Loading data...</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="sc-preview-empty-state">
            <div className="sc-preview-empty-icon">{fileIcon}</div>
            <h5 className="sc-preview-empty-title">No data found</h5>
            <p className="sc-preview-empty-sub">Try adjusting your filters or date range</p>
          </div>
        ) : (
          <div className="sc-preview-table-scroll">
            <table className="sc-preview-table">
              <thead>
                <tr className="sc-preview-thead-row">
                  {displayColumns.map((col) => (
                    <th key={col.alias} className="sc-preview-th">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={`sc-preview-tr${rowIdx % 2 === 0 ? '' : ' sc-preview-tr-alt'}`}
                  >
                    {displayColumns.map((col) => (
                      <td key={col.alias} className="sc-preview-td">
                        {String(row[col.alias] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer — left "X-Y of Z", right Prev|[badge]|Next */}
      <div className="sc-preview-pagination">
        <div className="sc-preview-pagination-left">
          {loading ? (
            <div className="sc-pagination-spinner" />
          ) : (
            <span className="sc-pagination-range">
              {start > 0 ? `${start}–${end} of ${total.toLocaleString()}` : 'No records'}
            </span>
          )}
        </div>

        <div className="sc-preview-pagination-right">
          <button
            className="sc-page-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => p - 1)}
          >
            Prev
          </button>
          <div className="sc-page-badge">{page}</div>
          <button
            className="sc-page-btn"
            disabled={!hasMore || loading}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
