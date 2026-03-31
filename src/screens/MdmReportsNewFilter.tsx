import React, { useState, useEffect, useCallback } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { TopFilterBar } from '../components/TopFilterBar';
import { AdditionalFilters } from '../components/AdditionalFilters';
import { CompactCheckboxDropdown } from '../components/CompactCheckboxDropdown';
import { NewDateFilter } from '../date/NewDateFilter';
import { GSTRMonthYearPicker } from '../date/GSTRMonthYearPicker';
import { loadCustomFiltersForReport, getMergedFilterSources } from '../services/mdmCustomFiltersService';
import { fetchFilterValues } from '../services/reportsDataService';
import { fetchDistributorMeta } from '../services/distributorMetaService';
import { downloadReport } from '../services/mdmReportsDownloadService';
import type { newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption, DrillDownPathItem, DistributorMeta } from '../services/types';
import { MdmReportsPreview } from './MdmReportsPreview';
import './MdmReportsFilter.css';

interface MdmReportsNewFilterProps {
  reportConfig: newReportConfig;
  onBack: () => void;
}

export function MdmReportsNewFilter({ reportConfig, onBack }: MdmReportsNewFilterProps) {
  // ── Hierarchy state ──────────────────────────────────────────────────────────
  const [salesDrillDownPath, setSalesDrillDownPath] = useState<DrillDownPathItem[]>([]);
  const [selectedSalesValues, setSelectedSalesValues] = useState<string[]>([]);
  const [geoDrillDownPath, setGeoDrillDownPath] = useState<DrillDownPathItem[]>([]);
  const [selectedGeoValues, setSelectedGeoValues] = useState<string[]>([]);
  const [selectedDistributorValues, setSelectedDistributorValues] = useState<string[]>([]);

  // ── Distributor meta ─────────────────────────────────────────────────────────
  const [distributorMeta, setDistributorMeta] = useState<DistributorMeta | null>(null);
  const [selectedDistributorTypes, setSelectedDistributorTypes] = useState<string[]>([]);
  const [selectedDistributorDivisions, setSelectedDistributorDivisions] = useState<string[]>([]);

  // ── Custom filters ───────────────────────────────────────────────────────────
  const [customFilters, setCustomFilters] = useState<FilterOption[]>([]);
  const [customFilterOptions, setCustomFilterOptions] = useState<Record<string, { label: string; value: string }[]>>({});
  const [customFilterLoading, setCustomFilterLoading] = useState<Record<string, boolean>>({});
  const [customFilterSelections, setCustomFilterSelections] = useState<Record<string, string[]>>({});

  // ── Additional filters ───────────────────────────────────────────────────────
  const [productStatus, setProductStatus] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] = useState<string[]>([]);
  const [distributorStatus, setDistributorStatus] = useState<string[]>([]);

  // ── Date range ───────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState<Dayjs>(dayjs().subtract(30, 'day').startOf('day'));
  const [toDate, setToDate] = useState<Dayjs>(dayjs().endOf('day'));
  const [gstrMonth, setGstrMonth] = useState<number | null>(null);
  const [gstrYear, setGstrYear] = useState<number | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Load on mount ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reportConfig.shouldShowCustomFilters) {
      loadCustomFiltersForReport(reportConfig).then(setCustomFilters);
    }

    if (reportConfig.showDistributorType || reportConfig.showDistributorDivision) {
      fetchDistributorMeta().then(setDistributorMeta).catch(console.error);
    }
  }, [reportConfig]);

  // Load custom filter options on mount
  useEffect(() => {
    for (const filter of customFilters) {
      loadFilterOptions(filter.alias);
    }
  }, [customFilters]);

  const loadFilterOptions = useCallback(
    async (alias: string) => {
      setCustomFilterLoading((prev) => ({ ...prev, [alias]: true }));
      try {
        const values = await fetchFilterValues({
          report: reportConfig.filterReportName ?? reportConfig.reportName,
          which: alias,
          since: fromDate.toISOString(),
          until: toDate.toISOString(),
        });
        setCustomFilterOptions((prev) => ({
          ...prev,
          [alias]: values.map((v) => ({ label: v, value: v })),
        }));
      } catch {
        // ignore
      } finally {
        setCustomFilterLoading((prev) => ({ ...prev, [alias]: false }));
      }
    },
    [reportConfig, fromDate, toDate]
  );

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Determine primary filter type
  const primaryFilter: 'sales' | 'geographical' | 'distributor' | null =
    salesDrillDownPath.length > 0
      ? 'sales'
      : geoDrillDownPath.length > 0
      ? 'geographical'
      : selectedDistributorValues.length > 0
      ? 'distributor'
      : null;

  // Build combined filters map for preview/download
  const allFilters: Record<string, string[]> = {
    ...customFilterSelections,
    ...(selectedDistributorValues.length > 0
      ? { distributor_code: selectedDistributorValues }
      : {}),
    ...(productStatus.length > 0 ? { product_status: productStatus } : {}),
    ...(batchStatus.length > 0 ? { batch_status: batchStatus } : {}),
    ...(distributorStatus.length > 0 ? { distributor_status: distributorStatus } : {}),
  };

  async function handleDownload(format: string) {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadReport({
        selectedReport: reportConfig,
        filters: allFilters,
        dateRangeType: reportConfig.periodFilter ? 'period' : 'daterange',
        fromDate,
        toDate,
        format,
        primaryFilter,
        customFilters: customFilters.map((f) => f.alias),
        salesDrillDownPath,
        geoDrillDownPath,
      });
      showNotification('Report downloaded successfully!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setDownloadError(msg);
      showNotification(msg, 'error');
    } finally {
      setDownloading(false);
    }
  }

  if (showPreview) {
    return (
      <MdmReportsPreview
        reportConfig={reportConfig}
        filters={allFilters}
        fromDate={fromDate}
        toDate={toDate}
        salesDrillDownPath={salesDrillDownPath}
        geoDrillDownPath={geoDrillDownPath}
        primaryFilter={primaryFilter}
        customFilters={customFilters}
        onBack={() => setShowPreview(false)}
        onDownload={handleDownload}
        downloading={downloading}
      />
    );
  }

  return (
    <div className="sc-filter-screen">
      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          padding: '12px 20px', borderRadius: 8,
          background: notification.type === 'success' ? '#059669' : '#dc2626',
          color: '#fff', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="sc-filter-header">
        <button className="sc-filter-back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="sc-filter-header-title">
          <h1>{reportConfig.name}</h1>
          <p>{reportConfig.description}</p>
        </div>
        <div className="sc-filter-header-actions">
          <button
            className="sc-btn sc-btn-secondary"
            onClick={() => setShowPreview(true)}
          >
            Preview
          </button>
          <button
            className="sc-btn sc-btn-primary"
            onClick={() => handleDownload('xlsx')}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download XLSX'}
          </button>
          <button
            className="sc-btn sc-btn-secondary"
            onClick={() => handleDownload('csv')}
            disabled={downloading}
          >
            CSV
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="sc-filter-body">
        {/* Hierarchy Filters */}
        {(reportConfig.salesHierarchyFilter?.enabled ||
          reportConfig.geographicalHierarchyFilter?.enabled ||
          reportConfig.distributorFilter?.enabled ||
          reportConfig.showDistributorType ||
          reportConfig.showDistributorDivision) && (
          <div className="sc-filter-section-card">
            <h3>Filters</h3>
            <TopFilterBar
              reportConfig={reportConfig}
              salesDrillDownPath={salesDrillDownPath}
              selectedSalesValues={selectedSalesValues}
              onSalesPathChange={setSalesDrillDownPath}
              onSalesValuesChange={setSelectedSalesValues}
              onSalesReset={() => {
                setSalesDrillDownPath([]);
                setSelectedSalesValues([]);
              }}
              geoDrillDownPath={geoDrillDownPath}
              selectedGeoValues={selectedGeoValues}
              onGeoPathChange={setGeoDrillDownPath}
              onGeoValuesChange={setSelectedGeoValues}
              onGeoReset={() => {
                setGeoDrillDownPath([]);
                setSelectedGeoValues([]);
              }}
              selectedDistributorValues={selectedDistributorValues}
              onDistributorChange={setSelectedDistributorValues}
              allDistributors={distributorMeta?.features ?? []}
              distributorTypes={distributorMeta?.types ?? []}
              distributorDivisions={distributorMeta?.divisions ?? []}
              selectedDistributorTypes={selectedDistributorTypes}
              selectedDistributorDivisions={selectedDistributorDivisions}
              onDistributorTypeChange={setSelectedDistributorTypes}
              onDistributorDivisionChange={setSelectedDistributorDivisions}
            />
          </div>
        )}

        {/* Date Filters */}
        <div className="sc-filter-section-card">
          <h3>Date Range</h3>
          {reportConfig.isGSTRReport ? (
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
          ) : (
            <NewDateFilter
              fromDate={fromDate}
              toDate={toDate}
              onFromChange={setFromDate}
              onToChange={setToDate}
              dateRangeAllowed={reportConfig.dateRangeAllowed}
            />
          )}
        </div>

        {/* Custom Filters */}
        {reportConfig.shouldShowCustomFilters && customFilters.length > 0 && (
          <div className="sc-filter-section-card">
            <h3>Additional Filters</h3>
            <div className="sc-filter-custom-row">
              {customFilters.map((filter) => {
                const isMerged = Boolean(reportConfig.mergedFilters?.[filter.alias]);
                return (
                  <CompactCheckboxDropdown
                    key={filter.alias}
                    label={filter.display}
                    options={customFilterOptions[filter.alias] ?? []}
                    selected={customFilterSelections[filter.alias] ?? []}
                    loading={customFilterLoading[filter.alias]}
                    onChange={(values) =>
                      setCustomFilterSelections((prev) => ({
                        ...prev,
                        [filter.alias]: values,
                      }))
                    }
                    placeholder={filter.display}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Filters (product/batch/distributor status) */}
        {reportConfig.showAdditionalFilters && (
          <div className="sc-filter-section-card">
            <h3>Status Filters</h3>
            <AdditionalFilters
              productStatus={productStatus}
              batchStatus={batchStatus}
              distributorStatus={distributorStatus}
              onProductStatusChange={setProductStatus}
              onBatchStatusChange={setBatchStatus}
              onDistributorStatusChange={setDistributorStatus}
            />
          </div>
        )}

        {downloadError && (
          <div style={{
            padding: '10px 16px', background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: 6, color: '#b91c1c', fontSize: 13,
          }}>
            {downloadError}
          </div>
        )}
      </div>
    </div>
  );
}
