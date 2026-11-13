import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Dayjs } from 'dayjs';
import { fetchReportData, fetchColumnDefinitions, type ReportSearchParams } from '../services/reportsDataService';
import { withDefaultDistributorScope } from '../utils/distributorScope';
import { isMergedFilterForReport, getMergedFilterSources, isSingleSelectFilterForReport } from '../services/mdmCustomFiltersService';
import { buildLocationFilters, buildUserFilters } from '../services/mdmReportsDownloadService';
import { CompactCheckboxDropdown } from '../components/CompactCheckboxDropdown';
import { applyCustomPayloadToMap, type newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption, DrillDownPathItem, ColumnOption } from '../services/types';
import './MdmReportsPreview.css';

const DEFAULT_PAGE_SIZE = 30;
/** Rows-per-page choices offered under the preview table. */
const PAGE_SIZE_OPTIONS = [10, 25, 30, 50, 100];

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
  optionsMap?: Record<string, { label: string; value: string }[]>;
  loadingMap?: Record<string, boolean>;
  onFilterChange?: (key: string, values: string[]) => void;
  onFilterOpen?: (key: string) => void;
  searchTextMap?: Record<string, string>;
  onFilterInputChange?: (key: string, value: string) => void;
  /** Show a reset button in the custom filter row (used when TopFilterBar is hidden, e.g. isDistributorView) */
  showCustomFilterReset?: boolean;
  onCustomFilterReset?: () => void;
  customFiltersLoading?: boolean;
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
  optionsMap = {},
  loadingMap = {},
  onFilterChange,
  onFilterOpen,
  searchTextMap = {},
  onFilterInputChange,
  showCustomFilterReset = false,
  onCustomFilterReset,
  customFiltersLoading = false,
}: MdmReportsPreviewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // Rows-per-page selector is on unless a report explicitly turns it off.
  const showRowsPerPage = reportConfig.showRowsPerPage !== false;
  const [pageSizeState, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // With the selector hidden, always fetch the default size — never a stale
  // value the user can no longer see or change.
  const pageSize = showRowsPerPage ? pageSizeState : DEFAULT_PAGE_SIZE;
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement>(null);
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

  // Close the rows-per-page menu on outside click, like the filter dropdowns.
  useEffect(() => {
    if (!pageSizeOpen) return;
    const handler = (e: MouseEvent) => {
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target as Node)) {
        setPageSizeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pageSizeOpen]);

  // Changing rows-per-page re-paginates from the start: the current page number
  // may not exist at the new size, and cached per-page counts no longer apply.
  function handlePageSizeChange(size: number) {
    if (size === pageSize) return;
    pageRowCountsRef.current = {};
    setPageSize(size);
    setPage(1);
  }

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

        // Hardcoded values from config — always injected. fetchReportData spreads
        // these comma-separated at top level (e.g. `company: "britannia"`).
        applyCustomPayloadToMap(apiFilters, reportConfig.sendCustomPayload);

        const locationFilters = buildLocationFilters(geoDrillDownPath);
        const userFilters = buildUserFilters(
          salesDrillDownPath,
          reportConfig.salesHierarchyFilter?.hierarchyOrder || []
        );

        const hasDrillDownPaths = locationFilters.length > 0 || userFilters.length > 0;

        // A distributor-view report defaults to the session's own distributor when
        // the user has picked none, matching the download path — without it this
        // preview rendered no rows for a report the same session could download.
        if (!hasDrillDownPaths) {
          withDefaultDistributorScope(apiFilters, reportConfig);
        }
        const hasDistributorCodes = apiFilters.distributor_code?.length > 0;

        if (!reportConfig.disableValidation && !hasDrillDownPaths && !hasDistributorCodes) {
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
          pageSize,
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
          setHasMore((data?.total ?? 0) > p * pageSize && p < (data?.totalPages ?? 1));
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
    [reportConfig, fromDate, toDate, filters, salesDrillDownPath, geoDrillDownPath, customFilters, showPreview, isNoPreviewReport, pageSize]
  );

  // One fetch effect, not two: `loadData` already changes identity whenever any
  // of its inputs (filters, dates, pageSize, …) change, so keying on both it and
  // `page` covers every case. Two separate effects fired twice for a single
  // change that moved both — the request-id guard discarded the loser, but the
  // duplicate request still went out.
  useEffect(() => {
    loadData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, page]);

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
      ? (pageRowCountsRef.current[page] ?? pageSize)
      : rows.length;
    if (rowCount === 0) return { start: 0, end: 0 };
    return {
      start: (page - 1) * pageSize + 1,
      end: (page - 1) * pageSize + rowCount,
    };
  }, [page, rows.length, loading, pageSize]);


  const fileIcon = (
    <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );

  // newDistFilter adds its Distributor dropdown to the custom filter row, so that
  // row must render even for reports that switch the report's own custom filters
  // off via shouldShowCustomFilters: false.
  const showCustomFilters = Boolean(
    ((reportConfig.shouldShowCustomFilters ?? true) || reportConfig.newDistFilter) &&
      customFilters.length > 0
  );

  // Reset button for the custom filter row (styled like the TopFilterBar reset).
  // Only rendered when requested (e.g. isDistributorView, where TopFilterBar is hidden).
  const customFilterResetBtn = showCustomFilterReset ? (
    <button className="sc-custom-filter-reset-btn" onClick={() => onCustomFilterReset?.()} type="button">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
      Reset
    </button>
  ) : null;
  // Not showing preview — show custom filters + empty/no-preview state
  if (!showPreview) {
    return (
      <div className="sc-preview-container">
        {showCustomFilters && (
          <div className="sc-preview-custom-filters">
            {customFiltersLoading ? (
              <div className="sc-preview-custom-filters-loading">
                <div className="sc-preview-spinner" style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 13, color: '#666' }}>Loading filters...</span>
              </div>
            ) : (
              <div className="sc-preview-custom-filters-row">
                {customFilters.map(cf => (
                  <CompactCheckboxDropdown
                    key={cf.alias}
                    label={cf.display}
                    options={optionsMap[cf.alias] || []}
                    selected={filters[cf.alias] || []}
                    onChange={values => onFilterChange?.(cf.alias, values)}
                    onOpen={() => onFilterOpen?.(cf.alias)}
                    searchText={searchTextMap[cf.alias] ?? ''}
                    onSearchChange={value => onFilterInputChange?.(cf.alias, value)}
                    loading={loadingMap[cf.alias] || false}
                    placeholder={cf.display}
                    width={152}
                    dropdownWidth={250}
                    multiSelect={!isSingleSelectFilterForReport(cf.alias, reportConfig)}
                    selectAllLabel={isSingleSelectFilterForReport(cf.alias, reportConfig) ? undefined : "Select all"}
                  />
                ))}
                {customFilterResetBtn}
              </div>
            )}
          </div>
        )}
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
      {/* Custom Filters Section — matches original's placement inside preview */}
      {showCustomFilters && (
        <div className="sc-preview-custom-filters">
          {customFiltersLoading ? (
            <div className="sc-preview-custom-filters-loading">
              <div className="sc-preview-spinner" style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 13, color: '#666' }}>Loading filters...</span>
            </div>
          ) : (
            <div className="sc-preview-custom-filters-row">
              {customFilters.map(cf => (
                <CompactCheckboxDropdown
                  key={cf.alias}
                  label={cf.display}
                  options={optionsMap[cf.alias] || []}
                  selected={filters[cf.alias] || []}
                  onChange={values => onFilterChange?.(cf.alias, values)}
                  onOpen={() => onFilterOpen?.(cf.alias)}
                  searchText={searchTextMap[cf.alias] ?? ''}
                  onSearchChange={value => onFilterInputChange?.(cf.alias, value)}
                  loading={loadingMap[cf.alias] || false}
                  placeholder={cf.display}
                  width={152}
                  dropdownWidth={250}
                  multiSelect={!isSingleSelectFilterForReport(cf.alias, reportConfig)}
                  selectAllLabel={isSingleSelectFilterForReport(cf.alias, reportConfig) ? undefined : "Select all"}
                />
              ))}
              {customFilterResetBtn}
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="sc-preview-table-container">
        {loading ? (
          <div className="sc-preview-loading-state">
            <div className="sc-preview-spinner" />
            <div className="sc-preview-loading-text">Loading data...</div>
          </div>
        ) : rows.length === 0 && displayColumns.length === 0 ? (
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
                    <th key={col.alias} className="sc-preview-th" title={col.label}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td className="sc-preview-td sc-preview-td-empty" colSpan={displayColumns.length}>
                      <div className="sc-preview-empty-icon">{fileIcon}</div>
                      <h5 className="sc-preview-empty-title">No data found</h5>
                      <p className="sc-preview-empty-sub">Try adjusting your filters or date range</p>
                    </td>
                  </tr>
                )}
                {rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={`sc-preview-tr${rowIdx % 2 === 0 ? '' : ' sc-preview-tr-alt'}`}
                  >
                    {displayColumns.map((col) => {
                      const cellValue = String(row[col.alias] ?? '');
                      return (
                        <td key={col.alias} className="sc-preview-td" title={cellValue}>
                          {cellValue}
                        </td>
                      );
                    })}
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
          {showRowsPerPage && (
          <div className="sc-rows-per-page" ref={pageSizeRef}>
            <span className="sc-rows-per-page-label">Rows per page:</span>
            <button
              type="button"
              className={`sc-rows-per-page-trigger${pageSizeOpen ? ' open' : ''}`}
              disabled={loading}
              onClick={() => setPageSizeOpen(o => !o)}
            >
              <span>{pageSize}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            {pageSizeOpen && (
              <div className="sc-rows-per-page-menu">
                {PAGE_SIZE_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`sc-rows-per-page-option${n === pageSize ? ' selected' : ''}`}
                    onClick={() => { handlePageSizeChange(n); setPageSizeOpen(false); }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
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
