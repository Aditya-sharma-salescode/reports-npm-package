import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
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
}

export function MdmReportsPreview({
  reportConfig,
  filters,
  fromDate,
  toDate,
  salesDrillDownPath,
  geoDrillDownPath,
  customFilters,
}: MdmReportsPreviewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const columnPanelRef = useRef<HTMLDivElement>(null);
  const lastRequestIdRef = useRef(0);
  const pageRowCountsRef = useRef<Record<number, number>>({});

  // Load column definitions once
  useEffect(() => {
    fetchColumnDefinitions(reportConfig.filterReportName ?? reportConfig.reportName)
      .then((cols) => {
        setColumns(cols);
        if (reportConfig.columnsToHide?.length) {
          setHiddenColumns(new Set(reportConfig.columnsToHide));
        }
      })
      .catch(console.error);
  }, [reportConfig]);

  // Reset page on filter/date/search change
  useEffect(() => {
    setPage(1);
    pageRowCountsRef.current = {};
  }, [filters, fromDate, toDate, salesDrillDownPath, geoDrillDownPath, search]);

  const loadData = useCallback(
    async (p: number, searchText: string) => {
      if (!reportConfig?.reportName) return;

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

        let since: string | undefined;
        let until: string | undefined;

        if (reportConfig.dateRangeFilter) {
          since = new Date(Date.UTC(
            fromDate.year(), fromDate.month(), fromDate.date() - 1, 18, 30, 0
          )).toISOString().replace(/\.\d{3}Z$/, 'Z');
          until = new Date(Date.UTC(
            toDate.year(), toDate.month(), toDate.date(), 18, 29, 59
          )).toISOString().replace(/\.\d{3}Z$/, 'Z');
        }

        const requestParams: ReportSearchParams = {
          report: reportConfig.reportName,
          page: p,
          pageSize: PAGE_SIZE,
          contains: searchText || undefined,
          filters: Object.keys(apiFilters).length > 0 ? apiFilters : undefined,
          distributorFilter: distributorFilterPayload,
          since,
          until,
        };

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
    [reportConfig, fromDate, toDate, filters, salesDrillDownPath, geoDrillDownPath, customFilters]
  );

  useEffect(() => {
    loadData(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  useEffect(() => {
    loadData(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Close column panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (columnPanelRef.current && !columnPanelRef.current.contains(e.target as Node)) {
        setShowColumnPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value), 400);
  }

  function toggleColumn(alias: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) next.delete(alias);
      else next.add(alias);
      return next;
    });
  }

  const visibleColumns = columns.filter((c) => !hiddenColumns.has(c.alias));

  const displayColumns: { alias: string; label: string }[] =
    visibleColumns.length > 0
      ? visibleColumns.map((c) => ({ alias: c.alias, label: c.display || c.alias }))
      : rows.length > 0
      ? Object.keys(rows[0]).filter(k => k !== '@filters' && !(reportConfig.columnsToHide || []).includes(k)).map((k) => ({ alias: k, label: k }))
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

  return (
    <div className="sc-preview-panel">
      {/* Toolbar */}
      <div className="sc-preview-toolbar">
        <div className="sc-preview-search-wrap">
          <span className="sc-preview-search-icon">🔍</span>
          <input
            className="sc-preview-search"
            type="text"
            placeholder="Search records..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="sc-preview-toolbar-right">
          {/* Zoom controls */}
          <div className="sc-preview-zoom-controls">
            <button
              className="sc-preview-zoom-btn"
              onClick={() => setFontSize((f) => Math.max(10, f - 1))}
              title="Zoom out"
            >
              −
            </button>
            <span className="sc-preview-zoom-label">{fontSize}px</span>
            <button
              className="sc-preview-zoom-btn"
              onClick={() => setFontSize((f) => Math.min(20, f + 1))}
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Column visibility */}
          <div className="sc-col-visibility-toggle" ref={columnPanelRef}>
            <button
              className="sc-btn-cols"
              onClick={() => setShowColumnPanel((v) => !v)}
            >
              ☰ Columns&nbsp;
              <span className="sc-cols-count">
                {displayColumns.length}/{columns.length || displayColumns.length}
              </span>
            </button>
            {showColumnPanel && (
              <div className="sc-col-visibility-panel">
                <div className="sc-col-panel-header">Column Visibility</div>
                {(columns.length > 0 ? columns : displayColumns.map(c => ({ alias: c.alias, display: c.label }))).map((col) => {
                  const alias = 'alias' in col ? col.alias : (col as { alias: string }).alias;
                  const label = 'display' in col ? (col as ColumnOption).display : (col as { label: string }).label;
                  return (
                    <div
                      key={alias}
                      className="sc-col-visibility-item"
                      onClick={() => toggleColumn(alias)}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.has(alias)}
                        onChange={() => toggleColumn(alias)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span>{label || alias}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="sc-preview-body">
        <div className="sc-preview-grid-wrapper">
          {loading ? (
            <div className="sc-preview-loading-state">
              <div className="sc-preview-spinner" />
              <div className="sc-preview-loading-text">Loading data...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="sc-preview-empty-state">
              <div className="sc-preview-empty-icon">📭</div>
              <div className="sc-preview-empty-title">No data found</div>
              <div className="sc-preview-empty-sub">Try adjusting your filters or date range</div>
            </div>
          ) : (
            <div className="sc-preview-table-scroll">
              <table className="sc-preview-table" style={{ fontSize }}>
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
      </div>

      {/* Pagination Footer — matches original: left "X-Y of Z", right Prev|[badge]|Next */}
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
