import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dayjs } from 'dayjs';
import { fetchReportData, fetchColumnDefinitions } from '../services/reportsDataService';
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
  onBack: () => void;
  onDownload: (format: string) => void;
  /** When true, renders as inline panel (no own header/back button) */
  inline?: boolean;
  downloading?: boolean;
}

export function MdmReportsPreview({
  reportConfig,
  filters,
  fromDate,
  toDate,
  salesDrillDownPath,
  geoDrillDownPath,
  primaryFilter,
  customFilters,
  onBack,
  onDownload,
  downloading = false,
}: MdmReportsPreviewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const columnPanelRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Load column definitions once
  useEffect(() => {
    fetchColumnDefinitions(reportConfig.filterReportName ?? reportConfig.reportName)
      .then((cols) => {
        setColumns(cols);
        // Apply columnsToHide from config
        if (reportConfig.columnsToHide?.length) {
          setHiddenColumns(new Set(reportConfig.columnsToHide));
        }
      })
      .catch(console.error);
  }, [reportConfig]);

  const loadData = useCallback(
    async (p: number, searchText: string) => {
      setLoading(true);
      try {
        const data = await fetchReportData({
          report: reportConfig.reportName,
          page: p,
          pageSize: PAGE_SIZE,
          contains: searchText || undefined,
          since: fromDate.toISOString(),
          until: toDate.toISOString(),
          filters,
        });
        setRows(data?.items ?? data?.data ?? []);
        setTotal(data?.total ?? 0);
      } catch (err) {
        console.error('Failed to load report data:', err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [reportConfig.reportName, fromDate, toDate, filters]
  );

  useEffect(() => {
    setPage(1);
    loadData(1, search);
  }, [loadData, search]);

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

  function handlePageChange(newPage: number) {
    setPage(newPage);
    loadData(newPage, search);
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

  // Determine visible column aliases from config or API
  const displayColumns: { alias: string; label: string }[] =
    visibleColumns.length > 0
      ? visibleColumns.map((c) => ({ alias: c.alias, label: c.display || c.alias }))
      : rows.length > 0
      ? Object.keys(rows[0]).map((k) => ({ alias: k, label: k }))
      : [];

  return (
    <div className="sc-preview-screen">
      {/* Header */}
      <div className="sc-preview-header">
        <button
          className="sc-btn sc-btn-secondary"
          style={{ fontSize: 13 }}
          onClick={onBack}
        >
          ← Filters
        </button>
        <div className="sc-preview-header-title">{reportConfig.name}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="sc-btn sc-btn-primary"
            onClick={() => onDownload('xlsx')}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : '↓ XLSX'}
          </button>
          <button
            className="sc-btn sc-btn-secondary"
            onClick={() => onDownload('csv')}
            disabled={downloading}
          >
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sc-preview-toolbar">
        <input
          className="sc-preview-search"
          type="text"
          placeholder="Search..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        <div className="sc-preview-stats">
          {loading ? 'Loading...' : `${total.toLocaleString()} records`}
        </div>

        {/* Zoom controls */}
        <div className="sc-preview-zoom-controls">
          <button
            className="sc-preview-zoom-btn"
            onClick={() => setFontSize((f) => Math.max(10, f - 1))}
            title="Zoom out"
          >
            −
          </button>
          <span style={{ fontSize: 11, color: '#6b7280', minWidth: 30, textAlign: 'center' }}>
            {fontSize}px
          </span>
          <button
            className="sc-preview-zoom-btn"
            onClick={() => setFontSize((f) => Math.min(18, f + 1))}
            title="Zoom in"
          >
            +
          </button>
        </div>

        {/* Column visibility */}
        <div className="sc-col-visibility-toggle" ref={columnPanelRef}>
          <button
            className="sc-btn sc-btn-secondary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setShowColumnPanel((v) => !v)}
          >
            Columns ({displayColumns.length}/{columns.length || displayColumns.length})
          </button>
          {showColumnPanel && (
            <div className="sc-col-visibility-panel">
              {columns.length === 0 && displayColumns.map((col) => (
                <div
                  key={col.alias}
                  className="sc-col-visibility-item"
                  onClick={() => toggleColumn(col.alias)}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col.alias)}
                    onChange={() => toggleColumn(col.alias)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ accentColor: '#6366f1' }}
                  />
                  {col.label}
                </div>
              ))}
              {columns.map((col) => (
                <div
                  key={col.alias}
                  className="sc-col-visibility-item"
                  onClick={() => toggleColumn(col.alias)}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col.alias)}
                    onChange={() => toggleColumn(col.alias)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ accentColor: '#6366f1' }}
                  />
                  {col.display || col.alias}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="sc-preview-body">
        <div className="sc-preview-grid-wrapper">
          {loading ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: '#6b7280', fontSize: 14,
            }}>
              <div>Loading data...</div>
            </div>
          ) : rows.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', flexDirection: 'column', gap: 8, color: '#9ca3af',
            }}>
              <div style={{ fontSize: 36 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>No data found</div>
              <div style={{ fontSize: 12 }}>Try adjusting your filters or date range</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize,
                tableLayout: 'auto',
              }}>
                <thead>
                  <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                    {displayColumns.map((col) => (
                      <th key={col.alias} style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#374151',
                        borderBottom: '2px solid #e5e7eb',
                        whiteSpace: 'nowrap',
                        fontSize: fontSize - 1,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: rowIdx % 2 === 0 ? '#fff' : '#f9fafb',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = '#eef2ff';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          rowIdx % 2 === 0 ? '#fff' : '#f9fafb';
                      }}
                    >
                      {displayColumns.map((col) => (
                        <td key={col.alias} style={{
                          padding: '8px 14px',
                          color: '#374151',
                          whiteSpace: 'nowrap',
                          maxWidth: 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
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

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="sc-preview-pagination">
          <button
            className="sc-page-btn"
            disabled={page <= 1}
            onClick={() => handlePageChange(1)}
          >
            «
          </button>
          <button
            className="sc-page-btn"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            ‹ Prev
          </button>
          <span style={{ color: '#374151' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            className="sc-page-btn"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next ›
          </button>
          <button
            className="sc-page-btn"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(totalPages)}
          >
            »
          </button>
          <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 12 }}>
            {total.toLocaleString()} total records · {PAGE_SIZE} per page
          </span>
        </div>
      )}
    </div>
  );
}
