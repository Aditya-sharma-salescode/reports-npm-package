import React from 'react';
import { CompactCheckboxDropdown } from './CompactCheckboxDropdown';
import { HierarchyDropdown } from './HierarchyDropdown';
import type { newReportConfig } from '../types/mdmReportsUtils';
import './TopFilterBar.css';

interface TopFilterBarProps {
  selectedReport: newReportConfig | null;

  // Distributor type/division
  distributorTypeOptions: { label: string; value: string }[];
  distributorDivisionOptions: { label: string; value: string }[];
  selectedTypes: string[];
  selectedDivisions: string[];
  onTypeChange: (values: string[]) => void;
  onDivisionChange: (values: string[]) => void;

  // Hierarchy source toggle
  distributorSource: 'geographical' | 'sales';
  onDistributorSourceChange: (source: 'geographical' | 'sales') => void;

  // Geography hierarchy
  geoEnabled: boolean;
  geoDisabled: boolean;
  geoChildren: React.ReactNode;
  isHierarchySyncing: boolean;

  // Sales hierarchy
  salesEnabled: boolean;
  salesDisabled: boolean;
  salesChildren: React.ReactNode;

  // Distributor filter
  distributorOptions: { label: string; value: string }[];
  selectedDistributors: string[];
  onDistributorChange: (values: string[]) => void;
  distributorLoading: boolean;
  onDistributorOpen: () => void;
  showDistributorFilter: boolean;

  // Reset
  onReset: () => void;
}

export function TopFilterBar({
  selectedReport,
  distributorTypeOptions,
  distributorDivisionOptions,
  selectedTypes,
  selectedDivisions,
  onTypeChange,
  onDivisionChange,
  distributorSource,
  onDistributorSourceChange,
  geoEnabled,
  geoDisabled,
  geoChildren,
  isHierarchySyncing,
  salesEnabled,
  salesDisabled,
  salesChildren,
  distributorOptions,
  selectedDistributors,
  onDistributorChange,
  distributorLoading,
  onDistributorOpen,
  showDistributorFilter,
  onReset,
}: TopFilterBarProps) {
  const showToggle = geoEnabled && salesEnabled;

  return (
    <div className="sc-topbar-wrapper">
      <div className="sc-topbar-inner">
        {/* Distributor Type */}
        {selectedReport?.showDistributorType !== false && (
          <CompactCheckboxDropdown
            label="Distributor Type"
            options={distributorTypeOptions}
            selected={selectedTypes}
            onChange={onTypeChange}
            selectAllLabel="Select all types"
          />
        )}

        {/* Distributor Division */}
        {selectedReport?.showDistributorDivision !== false && (
          <CompactCheckboxDropdown
            label="Distributor Division"
            options={distributorDivisionOptions}
            selected={selectedDivisions}
            onChange={onDivisionChange}
            selectAllLabel="Select all divisions"
          />
        )}

        {/* Geography */}
        {geoEnabled && (
          <div className="sc-topbar-hierarchy-group">
            {showToggle && (
              <input
                type="radio"
                className="sc-topbar-radio"
                checked={distributorSource === 'geographical'}
                onChange={() => onDistributorSourceChange('geographical')}
              />
            )}
            <HierarchyDropdown
              label="Geography"
              width={325}
              disabled={geoDisabled}
              isLoading={isHierarchySyncing}
            >
              {geoChildren}
            </HierarchyDropdown>
          </div>
        )}

        {/* Sales Hierarchy */}
        {salesEnabled && (
          <div className="sc-topbar-hierarchy-group">
            {showToggle && (
              <input
                type="radio"
                className="sc-topbar-radio"
                checked={distributorSource === 'sales'}
                onChange={() => onDistributorSourceChange('sales')}
              />
            )}
            <div className="sc-topbar-sales-row">
              <HierarchyDropdown
                label="Sales Hierarchy"
                width={325}
                disabled={salesDisabled}
                isLoading={isHierarchySyncing}
              >
                {salesChildren}
              </HierarchyDropdown>

              {/* Distributor filter next to Sales */}
              {showDistributorFilter && salesEnabled && (
                <CompactCheckboxDropdown
                  label="Select Distributor"
                  options={distributorOptions}
                  selected={selectedDistributors}
                  onChange={onDistributorChange}
                  loading={distributorLoading}
                  onOpen={onDistributorOpen}
                  selectAllLabel={selectedReport?.isGSTRReport ? undefined : "Select all distributors"}
                  multiSelect={!selectedReport?.isGSTRReport}
                  width={170}
                  dropdownWidth={250}
                />
              )}
            </div>
          </div>
        )}

        {/* Distributor filter standalone (when no sales hierarchy) */}
        {showDistributorFilter && !salesEnabled && (
          <CompactCheckboxDropdown
            label="Select Distributor"
            options={distributorOptions}
            selected={selectedDistributors}
            onChange={onDistributorChange}
            loading={distributorLoading}
            onOpen={onDistributorOpen}
            selectAllLabel={selectedReport?.isGSTRReport ? undefined : "Select all distributors"}
            multiSelect={!selectedReport?.isGSTRReport}
            width={170}
            dropdownWidth={250}
          />
        )}

        {/* Dotted separator */}
        <div className="sc-topbar-divider" />

        {/* Reset */}
        <button className="sc-topbar-reset-btn" onClick={onReset} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          Reset
        </button>
      </div>
    </div>
  );
}
