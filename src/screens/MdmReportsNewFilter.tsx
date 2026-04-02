import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { NewDateFilter } from '../date/NewDateFilter';
import { GSTRMonthYearPicker } from '../date/GSTRMonthYearPicker';
import { SalesHierarchyFilter } from '../utils/SalesHierarchyFilter';
import { GeographicalHierarchyFilter } from '../utils/GeographicalHierarchyFilter';
import { CompactCheckboxDropdown } from '../components/CompactCheckboxDropdown';
import { TopFilterBar } from '../components/TopFilterBar';
import { loadCustomFiltersForReport, isMergedFilterForReport, getMergedFilterSources } from '../services/mdmCustomFiltersService';
import { fetchFilterValues, fetchColumnDefinitions, fetchLocationUsers, fetchChildrenUsers } from '../services/reportsDataService';
import { fetchDistributorMeta, filterDistributorsBySelections } from '../services/distributorMetaService';
import { downloadReport, buildLocationFilters, buildUserFilters } from '../services/mdmReportsDownloadService';
import { getAuthContext } from '../config/auth';
import type { newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption, DistributorMeta, DrillDownPathItem, DistributorFeature } from '../services/types';
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
  // ── Sales hierarchy ─────────────────────────────────────────────────────────
  const [salesLevel, setSalesLevel] = useState<string | null>(null);
  const [salesValues, setSalesValues] = useState<string[]>([]);

  // ── Geo hierarchy ────────────────────────────────────────────────────────────
  const [geoLevel, setGeoLevel] = useState<string | null>(null);
  const [geoValues, setGeoValues] = useState<string[]>([]);

  // ── Distributor ─────────────────────────────────────────────────────────────
  const [selectedDistributors, setSelectedDistributors] = useState<string[]>([]);
  const [distributorOptions, setDistributorOptions] = useState<{ label: string; value: string }[]>([]);
  const [distributorLoading, setDistributorLoading] = useState(false);

  // ── Distributor type / division ──────────────────────────────────────────────
  const [distributorMeta, setDistributorMeta] = useState<DistributorMeta | null>(null);
  const [distributorFeatures, setDistributorFeatures] = useState<DistributorFeature[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);

  // ── Hierarchy source toggle ──────────────────────────────────────────────────
  const [distributorSource, setDistributorSource] = useState<'geographical' | 'sales'>(() => {
    if (reportConfig.geographicalHierarchyFilter?.enabled) return 'geographical';
    if (reportConfig.salesHierarchyFilter?.enabled) return 'sales';
    return 'geographical';
  });

  // ── Custom filters ──────────────────────────────────────────────────────────
  const [customFilters, setCustomFilters] = useState<FilterOption[]>([]);
  const [customFilterOptions, setCustomFilterOptions] = useState<Record<string, { label: string; value: string }[]>>({});
  const [customFilterLoading, setCustomFilterLoading] = useState<Record<string, boolean>>({});
  const [customFilterSelections, setCustomFilterSelections] = useState<Record<string, string[]>>({});

  // ── Date ────────────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState<Dayjs>(dayjs());
  const [toDate, setToDate] = useState<Dayjs>(dayjs());
  const [dateFilterKey, setDateFilterKey] = useState(0);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isHierarchySyncing, setIsHierarchySyncing] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const noPreview = isNoPreviewReport(reportConfig);
  const salesConfig = reportConfig.salesHierarchyFilter;
  const geoConfig = reportConfig.geographicalHierarchyFilter;
  const distConfig = reportConfig.distributorFilter;
  const isDistributorView = reportConfig.isDistributorView;

  const geoEnabled = !!geoConfig?.enabled;
  const salesEnabled = !!salesConfig?.enabled;
  const showToggle = geoEnabled && salesEnabled;
  const isGeoActive = geoEnabled && (!showToggle || distributorSource === 'geographical');
  const isSalesActive = salesEnabled && (!showToggle || distributorSource === 'sales');

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

  const hasSalesDrillDown = salesDrillDownPath.length > 0;
  const hasGeoDrillDown = geoDrillDownPath.length > 0;
  const hasDirectDistributor = selectedDistributors.length > 0;
  const hasFilters = hasSalesDrillDown || hasGeoDrillDown || hasDirectDistributor || isDistributorView;
  const isPreviewDisabled = !hasFilters;
  const isDownloadDisabled = !hasFilters;

  // ── Close download menu on outside click ────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) setDownloadMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reportConfig.shouldShowCustomFilters) {
      loadCustomFiltersForReport(reportConfig).then(setCustomFilters);
    }
    // Load distributor meta (for type/division dropdowns + distributor feature cache)
    fetchDistributorMeta().then(meta => {
      setDistributorMeta(meta);
      setDistributorFeatures(meta.features);
    }).catch(console.error);
  }, [reportConfig]);

  // Load custom filter options
  useEffect(() => {
    for (const filter of customFilters) {
      loadFilterOpts(filter.alias);
    }
  }, [customFilters]);

  const loadFilterOpts = useCallback(async (alias: string) => {
    if (!reportConfig?.reportName) return;
    setCustomFilterLoading(p => ({ ...p, [alias]: true }));
    try {
      // Build hierarchy-based distributor filter payload
      const locationFilters = buildLocationFilters(geoDrillDownPath);
      const userFilters = buildUserFilters(
        salesDrillDownPath,
        reportConfig.salesHierarchyFilter?.hierarchyOrder || []
      );

      const distributorFilterPayload =
        (locationFilters.length > 0 || userFilters.length > 0)
          ? {
              locationFilters: locationFilters.length > 0 ? locationFilters : undefined,
              userFilters: userFilters.length > 0 ? userFilters : undefined,
            }
          : undefined;

      // Pass distributor codes as additionalFilters
      const distributorCodes = selectedDistributors.length > 0 ? selectedDistributors : [];
      const additionalFilters: Record<string, string[]> | undefined =
        distributorCodes.length > 0 ? { distributor_code: distributorCodes } : undefined;

      // Date range
      let since: string | undefined;
      let until: string | undefined;
      if (reportConfig.dateRangeFilter && fromDate && toDate) {
        since = new Date(Date.UTC(
          fromDate.year(), fromDate.month(), fromDate.date() - 1, 18, 30, 0
        )).toISOString().replace(/\.\d{3}Z$/, 'Z');
        until = new Date(Date.UTC(
          toDate.year(), toDate.month(), toDate.date(), 18, 29, 59
        )).toISOString().replace(/\.\d{3}Z$/, 'Z');
      }

      // Dependency filters: other custom filter selections
      const dependencyFilters: Record<string, string[]> = {};
      for (const [key, vals] of Object.entries(customFilterSelections)) {
        if (key === alias) continue;
        if (vals && vals.length > 0 && vals[0] !== '') {
          dependencyFilters[key] = vals;
        }
      }

      const values = await fetchFilterValues({
        report: reportConfig.filterReportName ?? reportConfig.reportName,
        which: alias,
        filters: Object.keys(dependencyFilters).length > 0 ? dependencyFilters : undefined,
        additionalFilters,
        since,
        until,
        distributorFilter: distributorFilterPayload,
      });
      const filteredValues = values.filter(v => v && String(v).trim() !== '');
      setCustomFilterOptions(p => ({
        ...p,
        [alias]: filteredValues.map(v => ({ label: String(v), value: String(v) })),
      }));
    } catch { /* ignore */ } finally {
      setCustomFilterLoading(p => ({ ...p, [alias]: false }));
    }
  }, [reportConfig, fromDate, toDate, geoDrillDownPath, salesDrillDownPath, selectedDistributors, customFilterSelections]);

  /**
   * Load distributor options — matches original's loadDistributorOptions logic exactly:
   * 1. If geo source + geo drilldown path → fetchLocationUsers for supplier designation
   * 2. If sales source + sales drilldown path → use supplier selections or fetchChildrenUsers
   * 3. Fallback → fetchChildrenUsers(loggedInUser, 'supplier')
   * 4. Cross-filter by selected types/divisions using distributorFeatures cache
   */
  const loadDistributorOptions = useCallback(async () => {
    if (!distConfig?.enabled) return;
    setDistributorLoading(true);
    try {
      let filterIds: string[] = [];
      let attemptedTargetedFetch = false;

      // Geographic hierarchy → fetch suppliers under selected location
      if (distributorSource === 'geographical' && geoConfig?.enabled) {
        if (geoDrillDownPath.length > 0) {
          const level = geoDrillDownPath[geoDrillDownPath.length - 1].level;
          const values = geoDrillDownPath
            .filter(item => item.level === level)
            .map(item => item.value);
          if (values.length > 0) {
            attemptedTargetedFetch = true;
            const supplierPromises = values.map(value =>
              fetchLocationUsers(level, value, 'supplier')
            );
            const supplierResults = await Promise.all(supplierPromises);
            filterIds = Array.from(new Set(supplierResults.flat().map(u => typeof u === 'string' ? u : u.loginId)));
          }
        }
      }

      // Sales hierarchy → use supplier-level selections or fetch children
      if (distributorSource === 'sales' && salesConfig?.enabled) {
        const hierarchyOrder = salesConfig.hierarchyOrder || [];
        if (hierarchyOrder.length > 0 && salesDrillDownPath.length > 0) {
          const supplierLevel = hierarchyOrder[hierarchyOrder.length - 1];

          const supplierSelections = salesDrillDownPath
            .filter(item => item.level === supplierLevel)
            .map(item => item.value);

          if (supplierSelections.length > 0) {
            attemptedTargetedFetch = true;
            filterIds = supplierSelections;
          } else {
            // Find deepest parent above supplier level
            const targetParent = [...salesDrillDownPath]
              .reverse()
              .find(item => {
                const levelIndex = hierarchyOrder.indexOf(item.level);
                const supplierIndex = hierarchyOrder.indexOf(supplierLevel);
                return levelIndex !== -1 && supplierIndex !== -1 && levelIndex < supplierIndex;
              });

            if (targetParent) {
              attemptedTargetedFetch = true;
              const parentSelections = salesDrillDownPath
                .filter(item => item.level === targetParent.level)
                .map(item => item.value);

              const childrenPromises = parentSelections.map(userId =>
                fetchChildrenUsers(userId, supplierLevel)
              );
              const childrenResults = await Promise.all(childrenPromises);
              filterIds = Array.from(new Set(childrenResults.flat().map(u => typeof u === 'string' ? u : u.loginId)));
            }
          }
        }
      }

      // Fallback: fetch all suppliers under logged-in user
      if (filterIds.length === 0 && !attemptedTargetedFetch) {
        const loggedInUser = JSON.parse(localStorage.getItem('authContext') ?? '{}')?.user;
        const designation = loggedInUser?.designation || [];
        const userId = designation.some((d: string) => d.toLowerCase() === 'reportadmin')
          ? loggedInUser?.loginId
          : loggedInUser?.assignedHierarchy || loggedInUser?.loginId;
        if (userId) {
          const allSuppliers = await fetchChildrenUsers(userId, 'supplier');
          filterIds = allSuppliers.map(u => typeof u === 'string' ? u : u.loginId);
        }
      }

      // Cross-filter by distributor type/division using cached features
      let filteredLoginIds: string[];
      if ((selectedTypes.length > 0 || selectedDivisions.length > 0) && distributorFeatures.length > 0) {
        filteredLoginIds = filterDistributorsBySelections(
          distributorFeatures,
          selectedTypes,
          selectedDivisions,
          filterIds.length > 0 ? filterIds : undefined
        );
      } else {
        filteredLoginIds = filterIds;
      }

      setDistributorOptions(filteredLoginIds.map(id => ({ label: id, value: id })));
    } catch {
      setDistributorOptions([]);
    } finally {
      setDistributorLoading(false);
    }
  }, [distConfig, geoConfig, salesConfig, distributorSource, geoDrillDownPath, salesDrillDownPath, selectedTypes, selectedDivisions, distributorFeatures]);

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
    setFromDate(dayjs()); setToDate(dayjs());
    setDateFilterKey(prev => prev + 1);
  }

  function handleDistributorSourceChange(source: 'geographical' | 'sales') {
    if (source === distributorSource) return;
    // Clear opposite hierarchy
    if (source === 'geographical') {
      setSalesLevel(null); setSalesValues([]);
    } else {
      setGeoLevel(null); setGeoValues([]);
    }
    setSelectedDistributors([]);
    setDistributorOptions([]);
    setDistributorSource(source);
  }

  // Clear distributor selection when hierarchy path, type, or division changes
  // (matches original's useEffect at ~line 2132)
  useEffect(() => {
    if (distConfig?.enabled) {
      setSelectedDistributors([]);
      setDistributorOptions([]);
    }
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(geoDrillDownPath),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(salesDrillDownPath),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(selectedTypes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(selectedDivisions),
    distributorSource,
  ]);

  // ── Combined filters map ─────────────────────────────────────────────────────
  const allFilters: Record<string, string[]> = {
    ...customFilterSelections,
    ...(selectedDistributors.length > 0 ? { distributor_code: selectedDistributors } : {}),
    ...(selectedTypes.length > 0 ? { distributor_type: selectedTypes } : {}),
    ...(selectedDivisions.length > 0 ? { distributor_division: selectedDivisions } : {}),
  };

  // ── Filter chips ─────────────────────────────────────────────────────────────
  type Chip = { key: string; label: string; value: string; count?: number; onRemove: () => void };
  const chips: Chip[] = [];

  if (selectedTypes.length > 0) {
    chips.push({
      key: 'distributor_type', label: 'Distributor type', value: selectedTypes[0],
      count: selectedTypes.length > 1 ? selectedTypes.length - 1 : undefined,
      onRemove: () => setSelectedTypes([]),
    });
  }
  if (selectedDivisions.length > 0) {
    chips.push({
      key: 'distributor_division', label: 'Distributor division', value: selectedDivisions[0],
      count: selectedDivisions.length > 1 ? selectedDivisions.length - 1 : undefined,
      onRemove: () => setSelectedDivisions([]),
    });
  }
  if (selectedDistributors.length > 0) {
    chips.push({
      key: 'distributor', label: 'Distributor', value: selectedDistributors[0],
      count: selectedDistributors.length > 1 ? selectedDistributors.length - 1 : undefined,
      onRemove: () => setSelectedDistributors([]),
    });
  }
  if (geoLevel && geoValues.length > 0) {
    chips.push({
      key: 'geo', label: geoLevel, value: geoValues[0],
      count: geoValues.length > 1 ? geoValues.length - 1 : undefined,
      onRemove: () => { setGeoLevel(null); setGeoValues([]); },
    });
  }
  if (salesLevel && salesValues.length > 0) {
    chips.push({
      key: 'sales', label: salesLevel, value: salesValues[0],
      count: salesValues.length > 1 ? salesValues.length - 1 : undefined,
      onRemove: () => { setSalesLevel(null); setSalesValues([]); },
    });
  }

  // ── Download ─────────────────────────────────────────────────────────────────
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
    reportConfig.isLiveReport ? 'Live reports cannot be previewed. Kindly download the report to continue.'
    : reportConfig.isPDFReport ? 'PDF reports cannot be previewed. Kindly download the report to continue.'
    : reportConfig.isGSTRReport ? 'GSTR reports cannot be previewed. Kindly download the report to continue.'
    : 'This report cannot be previewed. Kindly download the report to continue.';

  const memoizedDateRange = useMemo(() => ({
    type: 'daterange' as const,
    fromDate: fromDate?.format('DD-MM-YYYY') ?? dayjs().format('DD-MM-YYYY'),
    toDate: toDate?.format('DD-MM-YYYY') ?? dayjs().format('DD-MM-YYYY'),
    selectedRange: 'custom',
  }), [fromDate, toDate]);

  return (
    <div className="sc-report-page">
      {/* Toast */}
      {notification && (
        <div className={`sc-notification ${notification.type}`}>{notification.msg}</div>
      )}

      {/* ── Row 1: Back + Title + Date picker ── */}
      <div className="sc-report-header">
        <div className="sc-report-header-left">
          <button className="sc-back-btn" onClick={onBack} title="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div className="sc-report-title">
            <h1>{reportConfig.name}</h1>
            <span className="sc-title-chevron">▾</span>
          </div>
        </div>

        <div className="sc-report-header-right">
          {reportConfig.dateRangeFilter && (
            <div className="sc-date-wrap">
              {reportConfig.isGSTRReport && (
                <>
                  <span className="sc-date-range-label">Month & Year</span>
                  <span className="sc-date-range-asterisk">*</span>
                </>
              )}
              {reportConfig.isGSTRReport ? (
                <GSTRMonthYearPicker
                  key={dateFilterKey}
                  selectedMonth={null}
                  selectedYear={null}
                  onChange={(m, y) => {
                    setFromDate(dayjs().month(m).year(y).startOf('month'));
                    setToDate(dayjs().month(m).year(y).endOf('month'));
                  }}
                  yearsRange={reportConfig.gstrYearsRange ?? 3}
                />
              ) : (
                <NewDateFilter
                  key={dateFilterKey}
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                  dateRangeAllowed={reportConfig.dateRangeAllowed}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: TopFilterBar + Preview + Download ── */}
      <div className="sc-filter-bar-row">
        <div className="sc-filter-bar-flex">
          {!isDistributorView && (
            <TopFilterBar
              selectedReport={reportConfig}
              distributorTypeOptions={distributorMeta?.types.map(t => ({ label: t, value: t })) ?? []}
              distributorDivisionOptions={distributorMeta?.divisions.map(d => ({ label: d, value: d })) ?? []}
              selectedTypes={selectedTypes}
              selectedDivisions={selectedDivisions}
              onTypeChange={setSelectedTypes}
              onDivisionChange={setSelectedDivisions}
              distributorSource={distributorSource}
              onDistributorSourceChange={handleDistributorSourceChange}
              geoEnabled={geoEnabled}
              geoDisabled={!isGeoActive}
              geoChildren={
                geoConfig ? (
                  <GeographicalHierarchyFilter
                    config={geoConfig}
                    selectedLevel={geoLevel}
                    selectedValues={geoValues}
                    onApply={(level, values) => {
                      setGeoLevel(level); setGeoValues(values);
                      setSalesLevel(null); setSalesValues([]);
                    }}
                    onReset={() => { setGeoLevel(null); setGeoValues([]); }}
                    onClose={() => {}}
                  />
                ) : <div />
              }
              isHierarchySyncing={isHierarchySyncing}
              salesEnabled={salesEnabled}
              salesDisabled={!isSalesActive}
              salesChildren={
                salesConfig ? (
                  <SalesHierarchyFilter
                    config={salesConfig}
                    selectedLevel={salesLevel}
                    selectedValues={salesValues}
                    onApply={(level, values) => {
                      setSalesLevel(level); setSalesValues(values);
                      setGeoLevel(null); setGeoValues([]);
                    }}
                    onReset={() => { setSalesLevel(null); setSalesValues([]); }}
                    onClose={() => {}}
                  />
                ) : <div />
              }
              distributorOptions={distributorOptions}
              selectedDistributors={selectedDistributors}
              onDistributorChange={setSelectedDistributors}
              distributorLoading={distributorLoading}
              onDistributorOpen={loadDistributorOptions}
              showDistributorFilter={!!distConfig?.enabled && !isDistributorView}
              onReset={handleReset}
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="sc-filter-actions">
          {!noPreview && (
            <button
              className="sc-btn-preview"
              onClick={() => setShowPreview(v => !v)}
              disabled={isPreviewDisabled}
            >
              {showPreview ? 'Preview' : 'Preview'}
            </button>
          )}

          <div className="sc-download-wrap" ref={downloadMenuRef}>
            <button
              className="sc-btn-download"
              onClick={() => !downloading && setDownloadMenuOpen(v => !v)}
              disabled={downloading || isDownloadDisabled}
            >
              {downloading ? (
                <><span className="sc-download-spinner" />Downloading...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </>
              )}
            </button>
            {downloadMenuOpen && !downloading && (
              <div className="sc-download-menu">
                {reportConfig.isPDFReport ? (
                  <div className="sc-download-menu-item" onClick={() => handleDownload('pdf')}>PDF</div>
                ) : reportConfig.isGSTRReport || reportConfig.customDownload ? (
                  <div className="sc-download-menu-item" onClick={() => handleDownload('xlsx')}>XLS</div>
                ) : (
                  <>
                    <div className="sc-download-menu-item" onClick={() => handleDownload('csv')}>CSV</div>
                    <div className="sc-download-menu-item" onClick={() => handleDownload('xlsx')}>XLS</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Filter chips ── */}
      {chips.length > 0 && (
        <div className="sc-filter-chips">
          {chips.map((chip) => (
            <span key={chip.key} className="sc-chip">
              <span className="sc-chip-key">{chip.label}: </span>
              <strong>{chip.value || '--'}</strong>
              {chip.count !== undefined && chip.count > 0 && ` +${chip.count}`}
              <span className="sc-chip-remove" onClick={chip.onRemove}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Row 4: Content area (matches original mdm-reports-left-section) ── */}
      <div className="sc-report-content">
        <MdmReportsPreview
          reportConfig={reportConfig}
          filters={allFilters}
          fromDate={fromDate}
          toDate={toDate}
          salesDrillDownPath={salesDrillDownPath}
          geoDrillDownPath={geoDrillDownPath}
          primaryFilter={primaryFilter}
          customFilters={customFilters}
          showPreview={showPreview && !noPreview}
          noPreviewText={noPreviewText}
          isNoPreviewReport={noPreview}
        />
      </div>
    </div>
  );
}
