// TopFilterBar is kept for potential external use but the main filter screen
// uses SalesHierarchyFilter / GeographicalHierarchyFilter directly.

import React from 'react';
import { CompactCheckboxDropdown } from './CompactCheckboxDropdown';
import { DistributorFilters } from './DistributorFilters';
import type { newReportConfig } from '../types/mdmReportsUtils';
import type { DistributorFeature } from '../services/types';
import './TopFilterBar.css';

interface TopFilterBarProps {
  reportConfig: newReportConfig;

  // Sales — level + values
  salesLevel: string | null;
  selectedSalesValues: string[];
  onSalesReset: () => void;

  // Geo — level + values
  geoLevel: string | null;
  selectedGeoValues: string[];
  onGeoReset: () => void;

  // Distributor
  selectedDistributorValues: string[];
  onDistributorChange: (values: string[]) => void;
  allDistributors?: DistributorFeature[];

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
  salesLevel,
  selectedSalesValues,
  onSalesReset,
  geoLevel,
  selectedGeoValues,
  onGeoReset,
  selectedDistributorValues,
  onDistributorChange,
  allDistributors = [],
  distributorTypes = [],
  distributorDivisions = [],
  selectedDistributorTypes,
  selectedDistributorDivisions,
  onDistributorTypeChange,
  onDistributorDivisionChange,
}: TopFilterBarProps) {
  const distConfig = reportConfig.distributorFilter;

  return (
    <div className="sc-top-filter-bar">
      {salesLevel && selectedSalesValues.length > 0 && (
        <div className="sc-filter-section">
          <span className="sc-filter-section-label">Sales: {salesLevel}</span>
          <button onClick={onSalesReset} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
            {selectedSalesValues.length} selected · Clear
          </button>
        </div>
      )}

      {geoLevel && selectedGeoValues.length > 0 && (
        <div className="sc-filter-section">
          <span className="sc-filter-section-label">Geo: {geoLevel}</span>
          <button onClick={onGeoReset} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
            {selectedGeoValues.length} selected · Clear
          </button>
        </div>
      )}

      {distConfig?.enabled && !reportConfig.isDistributorView && (
        <CompactCheckboxDropdown
          label={distConfig.label}
          options={allDistributors.map(f => ({ label: (f.name as string) || f.loginId, value: f.loginId }))}
          selected={selectedDistributorValues}
          onChange={onDistributorChange}
          placeholder={distConfig.label}
        />
      )}

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
