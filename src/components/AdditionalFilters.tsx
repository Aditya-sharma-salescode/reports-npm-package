import React from 'react';
import { CompactCheckboxDropdown } from './CompactCheckboxDropdown';

const PRODUCT_STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const BATCH_STATUS_OPTIONS = [
  { label: 'Valid', value: 'valid' },
  { label: 'Expired', value: 'expired' },
  { label: 'Near Expiry', value: 'near_expiry' },
];

const DISTRIBUTOR_STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

interface AdditionalFiltersProps {
  productStatus: string[];
  batchStatus: string[];
  distributorStatus: string[];
  onProductStatusChange: (values: string[]) => void;
  onBatchStatusChange: (values: string[]) => void;
  onDistributorStatusChange: (values: string[]) => void;
}

export function AdditionalFilters({
  productStatus,
  batchStatus,
  distributorStatus,
  onProductStatusChange,
  onBatchStatusChange,
  onDistributorStatusChange,
}: AdditionalFiltersProps) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <CompactCheckboxDropdown
        label="Product Status"
        options={PRODUCT_STATUS_OPTIONS}
        selected={productStatus}
        onChange={onProductStatusChange}
        searchable={false}
        placeholder="Product Status"
      />
      <CompactCheckboxDropdown
        label="Batch Status"
        options={BATCH_STATUS_OPTIONS}
        selected={batchStatus}
        onChange={onBatchStatusChange}
        searchable={false}
        placeholder="Batch Status"
      />
      <CompactCheckboxDropdown
        label="Distributor Status"
        options={DISTRIBUTOR_STATUS_OPTIONS}
        selected={distributorStatus}
        onChange={onDistributorStatusChange}
        searchable={false}
        placeholder="Distributor Status"
      />
    </div>
  );
}
