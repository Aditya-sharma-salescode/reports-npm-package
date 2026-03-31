import React from 'react';
import { HierarchyDropdown } from './HierarchyDropdown';
import { SalesHierarchyFilter } from '../utils/SalesHierarchyFilter';
import { GeographicalHierarchyFilter } from '../utils/GeographicalHierarchyFilter';
import { DistributorFilter } from '../utils/DistributorFilter';
import { DistributorFilters } from './DistributorFilters';
import type { newReportConfig } from '../types/mdmReportsUtils';
import type { DrillDownPathItem, DistributorFeature } from '../services/types';
import { summarizeDrillDownPath } from '../utils/hierarchyHelpers';
import './TopFilterBar.css';

interface TopFilterBarProps {
  reportConfig: newReportConfig;

  // Sales
  salesDrillDownPath: DrillDownPathItem[];
  selectedSalesValues: string[];
  onSalesPathChange: (path: DrillDownPathItem[]) => void;
  onSalesValuesChange: (values: string[]) => void;
  onSalesReset: () => void;

  // Geo
  geoDrillDownPath: DrillDownPathItem[];
  selectedGeoValues: string[];
  onGeoPathChange: (path: DrillDownPathItem[]) => void;
  onGeoValuesChange: (values: string[]) => void;
  onGeoReset: () => void;

  // Distributor
  selectedDistributorValues: string[];
  onDistributorChange: (values: string[]) => void;
  allDistributors?: DistributorFeature[];
  allowedDistributorLoginIds?: string[];

  // Distributor type / division
  distributorTypes?: string[];
  distributorDivisions?: string[];
  selectedDistributorTypes: string[];
  selectedDistributorDivisions: string[];
  onDistributorTypeChange: (values: string[]) => void;
  onDistributorDivisionChange: (values: string[]) => void;
}

export function TopFilterBar({
  reportConfig,
  salesDrillDownPath,
  selectedSalesValues,
  onSalesPathChange,
  onSalesValuesChange,
  onSalesReset,
  geoDrillDownPath,
  selectedGeoValues,
  onGeoPathChange,
  onGeoValuesChange,
  onGeoReset,
  selectedDistributorValues,
  onDistributorChange,
  allDistributors = [],
  allowedDistributorLoginIds,
  distributorTypes = [],
  distributorDivisions = [],
  selectedDistributorTypes,
  selectedDistributorDivisions,
  onDistributorTypeChange,
  onDistributorDivisionChange,
}: TopFilterBarProps) {
  const salesConfig = reportConfig.salesHierarchyFilter;
  const geoConfig = reportConfig.geographicalHierarchyFilter;
  const distConfig = reportConfig.distributorFilter;

  const salesSummary =
    salesDrillDownPath.length > 0
      ? summarizeDrillDownPath(salesDrillDownPath)
          .map((s) => `${s.count} ${s.level}`)
          .join(', ')
      : undefined;

  const geoSummary =
    geoDrillDownPath.length > 0
      ? summarizeDrillDownPath(geoDrillDownPath)
          .map((s) => `${s.count} ${s.level}`)
          .join(', ')
      : undefined;

  return (
    <div className="sc-top-filter-bar">
      {/* Sales Hierarchy */}
      {salesConfig?.enabled && (
        <HierarchyDropdown
          label="Sales Hierarchy"
          summaryText={salesSummary ? `Sales: ${salesSummary}` : 'Sales Hierarchy'}
          isActive={salesDrillDownPath.length > 0}
          onReset={onSalesReset}
        >
          <SalesHierarchyFilter
            config={salesConfig}
            drillDownPath={salesDrillDownPath}
            onPathChange={onSalesPathChange}
            onSelectedValuesChange={onSalesValuesChange}
            selectedValues={selectedSalesValues}
          />
        </HierarchyDropdown>
      )}

      {/* Geographical Hierarchy */}
      {geoConfig?.enabled && (
        <HierarchyDropdown
          label="Geography"
          summaryText={geoSummary ? `Geo: ${geoSummary}` : 'Geography'}
          isActive={geoDrillDownPath.length > 0}
          onReset={onGeoReset}
        >
          <GeographicalHierarchyFilter
            config={geoConfig}
            drillDownPath={geoDrillDownPath}
            onPathChange={onGeoPathChange}
            onSelectedValuesChange={onGeoValuesChange}
            selectedValues={selectedGeoValues}
          />
        </HierarchyDropdown>
      )}

      {/* Distributor */}
      {distConfig?.enabled && !reportConfig.isDistributorView && (
        <DistributorFilter
          config={distConfig}
          isDistributorView={reportConfig.isDistributorView}
          selectedValues={selectedDistributorValues}
          onChange={onDistributorChange}
          allowedLoginIds={allowedDistributorLoginIds}
          allDistributors={allDistributors}
        />
      )}

      {/* Distributor Type & Division */}
      <DistributorFilters
        showType={reportConfig.showDistributorType}
        showDivision={reportConfig.showDistributorDivision}
        types={distributorTypes}
        divisions={distributorDivisions}
        selectedTypes={selectedDistributorTypes}
        selectedDivisions={selectedDistributorDivisions}
        onTypeChange={onDistributorTypeChange}
        onDivisionChange={onDistributorDivisionChange}
      />
    </div>
  );
}
