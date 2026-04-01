import { useState, useEffect, useRef, useCallback } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { NewDateFilter } from '../date/NewDateFilter';
import { GSTRMonthYearPicker } from '../date/GSTRMonthYearPicker';
import { SalesHierarchyFilter } from '../utils/SalesHierarchyFilter';
import { GeographicalHierarchyFilter } from '../utils/GeographicalHierarchyFilter';
import { CompactCheckboxDropdown } from '../components/CompactCheckboxDropdown';
import { loadCustomFiltersForReport } from '../services/mdmCustomFiltersService';
import { fetchFilterValues } from '../services/reportsDataService';
import { fetchDistributorMeta } from '../services/distributorMetaService';
import { downloadReport } from '../services/mdmReportsDownloadService';
import type { newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption, DistributorMeta, DrillDownPathItem } from '../services/types';
import { MdmReportsPreview } from './MdmReportsPreview';
import './MdmReportsFilter.css';

interface MdmReportsNewFilterProps {
  reportConfig: newReportConfig;
  onBack: () => void;
}

function isNoPreviewReport(config: newReportConfig) {
  return config.isLiveReport || config.isGSTRReport || config.isPDFReport || config.customDownload;
}

export function MdmReportsNewFilter({ reportConfig, onBack }: MdmReportsNewFilterProps) {
  // ── Sales hierarchy ──────────────────────────────────────────────────────────
  const [salesLevel, setSalesLevel] = useState<string | null>(null);
  const [salesValues, setSalesValues] = useState<string[]>([]);
  const [salesOpen, setSalesOpen] = useState(false);
  const salesRef = useRef<HTMLDivElement>(null);

  // ── Geo hierarchy ─────────────────────────────────────────────────────────────
  const [geoLevel, setGeoLevel] = useState<string | null>(null);
  const [geoValues, setGeoValues] = useState<string[]>([]);
  const [geoOpen, setGeoOpen] = useState(false);
  const geoRef = useRef<HTMLDivElement>(null);

  // ── Distributor ──────────────────────────────────────────────────────────────
  const [selectedDistributors, setSelectedDistributors] = useState<string[]>([]);
  const [distributorOptions, setDistributorOptions] = useState<{ label: string; value: string }[]>([]);

  // ── Distributor type / division ───────────────────────────────────────────────
  const [distributorMeta, setDistributorMeta] = useState<DistributorMeta | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);

  // ── Custom filters ───────────────────────────────────────────────────────────
  const [customFilters, setCustomFilters] = useState<FilterOption[]>([]);
  const [customFilterOptions, setCustomFilterOptions] = useState<Record<string, { label: string; value: string }[]>>({});
  const [customFilterLoading, setCustomFilterLoading] = useState<Record<string, boolean>>({});
  const [customFilterSelections, setCustomFilterSelections] = useState<Record<string, string[]>>({});

  // ── Date ─────────────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState<Dayjs>(dayjs().subtract(30, 'day').startOf('day'));
  const [toDate, setToDate] = useState<Dayjs>(dayjs().endOf('day'));
  const [gstrMonth, setGstrMonth] = useState<number | null>(null);
  const [gstrYear, setGstrYear] = useState<number | null>(null);

  // ── UI ────────────────────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const noPreview = isNoPreviewReport(reportConfig);
  const salesConfig = reportConfig.salesHierarchyFilter;
  const geoConfig = reportConfig.geographicalHierarchyFilter;
  const distConfig = reportConfig.distributorFilter;

  // ── Close dropdowns on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (salesRef.current && !salesRef.current.contains(e.target as Node)) setSalesOpen(false);
      if (geoRef.current && !geoRef.current.contains(e.target as Node)) setGeoOpen(false);
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) setDownloadMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load on mount ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reportConfig.shouldShowCustomFilters) {
      loadCustomFiltersForReport(reportConfig).then(setCustomFilters);
    }
    if (reportConfig.showDistributorType || reportConfig.showDistributorDivision) {
      fetchDistributorMeta().then(setDistributorMeta).catch(console.error);
    }
    if (distConfig?.enabled) {
      fetchDistributorMeta().then(meta => {
        setDistributorOptions(
          meta.features.map(f => ({ label: (f.name as string) || f.loginId, value: f.loginId }))
        );
      }).catch(console.error);
    }
  }, [reportConfig]);

  // Load custom filter options
  useEffect(() => {
    for (const filter of customFilters) {
      loadFilterOpts(filter.alias);
    }
  }, [customFilters]);

  const loadFilterOpts = useCallback(async (alias: string) => {
    setCustomFilterLoading(p => ({ ...p, [alias]: true }));
    try {
      const values = await fetchFilterValues({
        report: reportConfig.filterReportName ?? reportConfig.reportName,
        which: alias,
      });
      setCustomFilterOptions(p => ({
        ...p,
        [alias]: values.map(v => ({ label: v, value: v })),
      }));
    } catch { /* ignore */ } finally {
      setCustomFilterLoading(p => ({ ...p, [alias]: false }));
    }
  }, [reportConfig]);

  function showNotif(msg: string, type: 'success' | 'error') {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }

  function handleReset() {
    setSalesLevel(null); setSalesValues([]);
    setGeoLevel(null); setGeoValues([]);
    setSelectedDistributors([]);
    setSelectedTypes([]); setSelectedDivisions([]);
    setCustomFilterSelections({});
    setShowPreview(false);
  }

  // ── Drill-down paths ──────────────────────────────────────────────────────────
  const salesDrillDownPath: DrillDownPathItem[] =
    salesLevel && salesValues.length > 0
      ? salesValues.map(v => ({ level: salesLevel, value: v }))
      : [];

  const geoDrillDownPath: DrillDownPathItem[] =
    geoLevel && geoValues.length > 0
      ? geoValues.map(v => ({ level: geoLevel, value: v }))
      : [];

  const primaryFilter: 'sales' | 'geographical' | 'distributor' | null =
    geoValues.length > 0 ? 'geographical'
    : salesValues.length > 0 ? 'sales'
    : selectedDistributors.length > 0 ? 'distributor'
    : null;

  // ── Combined filters map ──────────────────────────────────────────────────────
  const allFilters: Record<string, string[]> = {
    ...customFilterSelections,
    ...(selectedDistributors.length > 0 ? { distributor_code: selectedDistributors } : {}),
  };

  // ── Chips ─────────────────────────────────────────────────────────────────────
  const chips: { key: string; value: string; onRemove: () => void }[] = [];
  if (selectedDistributors.length > 0) {
    for (const d of selectedDistributors) {
      chips.push({ key: 'Distributor', value: d, onRemove: () => setSelectedDistributors(p => p.filter(x => x !== d)) });
    }
  }
  if (geoLevel && geoValues.length > 0) {
    for (const v of geoValues) {
      chips.push({ key: geoLevel, value: v, onRemove: () => { setGeoLevel(null); setGeoValues([]); } });
    }
  }
  if (salesLevel && salesValues.length > 0) {
    for (const v of salesValues) {
      chips.push({ key: salesLevel, value: v, onRemove: () => { setSalesLevel(null); setSalesValues([]); } });
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────────
  async function handleDownload(format: string) {
    setDownloading(true);
    setDownloadMenuOpen(false);
    try {
      await downloadReport({
        selectedReport: reportConfig,
        filters: allFilters,
        dateRangeType: reportConfig.periodFilter ? 'period' : 'daterange',
        fromDate,
        toDate,
        format,
        primaryFilter,
        customFilters: customFilters.map(f => f.alias),
        salesDrillDownPath,
        geoDrillDownPath,
      });
      showNotif('Downloaded successfully!', 'success');
    } catch (err) {
      showNotif(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }

  const noPreviewText =
    reportConfig.isLiveReport
      ? 'Live reports cannot be previewed. Kindly download the report to continue.'
      : reportConfig.isPDFReport
      ? 'PDF reports cannot be previewed. Kindly download the report to continue.'
      : reportConfig.isGSTRReport
      ? 'GSTR reports cannot be previewed. Kindly download the report to continue.'
      : 'This report cannot be previewed. Kindly download the report to continue.';

  return (
    <div className="sc-report-page">
      {/* Notification toast */}
      {notification && (
        <div className={`sc-notification ${notification.type}`}>{notification.msg}</div>
      )}

      {/* ── Header ── */}
      <div className="sc-report-header">
        <div className="sc-report-header-left">
          <button className="sc-back-btn" onClick={onBack} title="Back to reports">
            ←
          </button>
          <div className="sc-report-title">
            <h1>{reportConfig.name}</h1>
          </div>
        </div>

        <div className="sc-report-header-right">
          {/* Date picker / GSTR picker */}
          {reportConfig.isGSTRReport ? (
            <div className="sc-gstr-date-wrap">
              <span className="sc-date-range-label">Period</span>
              <span className="sc-date-range-asterisk">*</span>
              <GSTRMonthYearPicker
                selectedMonth={gstrMonth}
                selectedYear={gstrYear}
                onChange={(m, y) => {
                  setGstrMonth(m);
                  setGstrYear(y);
                  setFromDate(dayjs().month(m).year(y).startOf('month'));
                  setToDate(dayjs().month(m).year(y).endOf('month'));
                }}
                yearsRange={reportConfig.gstrYearsRange ?? 3}
              />
            </div>
          ) : (
            <NewDateFilter
              fromDate={fromDate}
              toDate={toDate}
              onFromChange={setFromDate}
              onToChange={setToDate}
              dateRangeAllowed={reportConfig.dateRangeAllowed}
            />
          )}

          {/* Preview toggle */}
          {!noPreview && (
            <button
              className={`sc-btn-preview${showPreview ? ' active' : ''}`}
              onClick={() => setShowPreview(v => !v)}
            >
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
          )}

          {/* Download with format menu */}
          <div className="sc-download-wrap" ref={downloadMenuRef}>
            <button
              className="sc-btn-download"
              onClick={() => setDownloadMenuOpen(v => !v)}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <span className="sc-download-spinner" />
                  Downloading...
                </>
              ) : (
                <>↓ Download</>
              )}
            </button>
            {downloadMenuOpen && !downloading && (
              <div className="sc-download-menu">
                <div className="sc-download-menu-item" onClick={() => handleDownload('xlsx')}>
                  <span>📊</span> Excel (XLSX)
                </div>
                <div className="sc-download-menu-item" onClick={() => handleDownload('csv')}>
                  <span>📄</span> CSV
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="sc-filter-bar">
        {/* Distributor Type */}
        {reportConfig.showDistributorType && distributorMeta && (
          <CompactCheckboxDropdown
            label="Distributor Type"
            options={distributorMeta.types.map(t => ({ label: t, value: t }))}
            selected={selectedTypes}
            onChange={setSelectedTypes}
            placeholder="Distributor Type"
            selectAllLabel="Select all types"
          />
        )}

        {/* Distributor Division */}
        {reportConfig.showDistributorDivision && distributorMeta && (
          <CompactCheckboxDropdown
            label="Distributor Division"
            options={distributorMeta.divisions.map(d => ({ label: d, value: d }))}
            selected={selectedDivisions}
            onChange={setSelectedDivisions}
            placeholder="Distributor Division"
          />
        )}

        {/* Geography */}
        {geoConfig?.enabled && (
          <div className="sc-hierarchy-filter-wrapper" ref={geoRef}>
            <span
              className={`sc-radio-indicator${geoValues.length > 0 ? ' active' : ''}`}
              onClick={() => { setGeoLevel(null); setGeoValues([]); }}
              title="Clear geography filter"
            />
            <div
              className={`sc-dropdown-trigger${geoOpen ? ' open' : ''}${geoValues.length > 0 ? ' active' : ''}${salesValues.length > 0 ? ' disabled' : ''}`}
              onClick={() => salesValues.length === 0 && setGeoOpen(v => !v)}
            >
              <span>Geography</span>
              <span className="sc-dropdown-chevron">▾</span>
            </div>
            {geoOpen && (
              <GeographicalHierarchyFilter
                config={geoConfig}
                selectedLevel={geoLevel}
                selectedValues={geoValues}
                onApply={(level, values) => { setGeoLevel(level); setGeoValues(values); setGeoOpen(false); }}
                onReset={() => { setGeoLevel(null); setGeoValues([]); }}
                onClose={() => setGeoOpen(false)}
              />
            )}
          </div>
        )}

        {/* Sales Hierarchy */}
        {salesConfig?.enabled && (
          <div className="sc-hierarchy-filter-wrapper" ref={salesRef}>
            <span
              className={`sc-radio-indicator${salesValues.length > 0 ? ' active' : ''}`}
              onClick={() => { setSalesLevel(null); setSalesValues([]); }}
              title="Clear sales filter"
            />
            <div
              className={`sc-dropdown-trigger${salesOpen ? ' open' : ''}${salesValues.length > 0 ? ' active' : ''}${geoValues.length > 0 ? ' disabled' : ''}`}
              onClick={() => geoValues.length === 0 && setSalesOpen(v => !v)}
            >
              <span>Sales Hierarchy</span>
              <span className="sc-dropdown-chevron">▾</span>
            </div>
            {salesOpen && (
              <SalesHierarchyFilter
                config={salesConfig}
                selectedLevel={salesLevel}
                selectedValues={salesValues}
                onApply={(level, values) => { setSalesLevel(level); setSalesValues(values); setSalesOpen(false); }}
                onReset={() => { setSalesLevel(null); setSalesValues([]); }}
                onClose={() => setSalesOpen(false)}
              />
            )}
          </div>
        )}

        {/* Distributor */}
        {distConfig?.enabled && !reportConfig.isDistributorView && (
          <CompactCheckboxDropdown
            label="Distributor"
            options={distributorOptions}
            selected={selectedDistributors}
            onChange={setSelectedDistributors}
            placeholder="Select Distributor"
          />
        )}

        <div className="sc-filter-bar-spacer" />
        <div className="sc-filter-separator" />
        <button className="sc-reset-btn" onClick={handleReset}>↺ Reset</button>
      </div>

      {/* ── Filter Chips ── */}
      {chips.length > 0 && (
        <div className="sc-filter-chips">
          {chips.map((chip, i) => (
            <span key={i} className="sc-chip">
              <span className="sc-chip-key">{chip.key}: </span>
              <span>{chip.value}</span>
              <span className="sc-chip-remove" onClick={chip.onRemove}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Custom filters row ── */}
      {reportConfig.shouldShowCustomFilters && customFilters.length > 0 && (
        <div className="sc-custom-filters-row">
          {customFilters.map(filter => (
            <CompactCheckboxDropdown
              key={filter.alias}
              label={filter.display}
              options={customFilterOptions[filter.alias] ?? []}
              selected={customFilterSelections[filter.alias] ?? []}
              loading={customFilterLoading[filter.alias]}
              onChange={values => setCustomFilterSelections(p => ({ ...p, [filter.alias]: values }))}
              placeholder={filter.display}
            />
          ))}
        </div>
      )}

      {/* ── Content Area ── */}
      <div className="sc-report-content">
        {noPreview ? (
          <div className="sc-empty-state">
            <div className="sc-empty-icon">📄</div>
            <div className="sc-empty-text">{noPreviewText}</div>
          </div>
        ) : !showPreview ? (
          <div className="sc-empty-state">
            <div className="sc-empty-icon">📄</div>
            <div className="sc-empty-text">Select filters to generate report</div>
          </div>
        ) : (
          <MdmReportsPreview
            reportConfig={reportConfig}
            filters={allFilters}
            fromDate={fromDate}
            toDate={toDate}
            salesDrillDownPath={salesDrillDownPath}
            geoDrillDownPath={geoDrillDownPath}
            primaryFilter={primaryFilter}
            customFilters={customFilters}
          />
        )}
      </div>
    </div>
  );
}
