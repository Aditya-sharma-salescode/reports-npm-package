import React from 'react';
import { CompactCheckboxDropdown } from './CompactCheckboxDropdown';

interface DistributorFiltersProps {
  showType?: boolean;
  showDivision?: boolean;
  types: string[];
  divisions: string[];
  selectedTypes: string[];
  selectedDivisions: string[];
  onTypeChange: (values: string[]) => void;
  onDivisionChange: (values: string[]) => void;
}

export function DistributorFilters({
  showType = false,
  showDivision = false,
  types,
  divisions,
  selectedTypes,
  selectedDivisions,
  onTypeChange,
  onDivisionChange,
}: DistributorFiltersProps) {
  if (!showType && !showDivision) return null;

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {showType && (
        <CompactCheckboxDropdown
          label="Distributor Type"
          options={types.map((t) => ({ label: t, value: t }))}
          selected={selectedTypes}
          onChange={onTypeChange}
          placeholder="Distributor Type"
        />
      )}
      {showDivision && (
        <CompactCheckboxDropdown
          label="Division"
          options={divisions.map((d) => ({ label: d, value: d }))}
          selected={selectedDivisions}
          onChange={onDivisionChange}
          placeholder="Division"
        />
      )}
    </div>
  );
}
