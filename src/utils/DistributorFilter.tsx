import React, { useEffect, useState, useCallback } from 'react';
import { CompactCheckboxDropdown } from '../components/CompactCheckboxDropdown';
import type { DistributorFilterConfig } from '../types/mdmReportsUtils';
import type { DistributorFeature } from '../services/types';
import { fetchLocationUsers, fetchChildrenUsers } from '../services/reportsDataService';
import { getAuthContext } from '../config/auth';

interface DistributorFilterProps {
  config: DistributorFilterConfig;
  isDistributorView: boolean;
  selectedValues: string[];
  onChange: (values: string[]) => void;
  // Optional pre-filtered list from hierarchy
  allowedLoginIds?: string[];
  allDistributors?: DistributorFeature[];
}

export function DistributorFilter({
  config,
  isDistributorView,
  selectedValues,
  onChange,
  allowedLoginIds,
  allDistributors = [],
}: DistributorFilterProps) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const buildOptions = useCallback(() => {
    const { loginId } = getAuthContext();

    let features = allDistributors;

    if (isDistributorView && loginId) {
      // Only the logged-in distributor
      features = features.filter((f) => f.loginId === loginId);
    }

    if (allowedLoginIds && allowedLoginIds.length > 0) {
      const allowed = new Set(allowedLoginIds);
      features = features.filter((f) => allowed.has(f.loginId));
    }

    setOptions(
      features.map((f) => ({
        label: (f.name as string) || f.loginId,
        value: f.loginId,
      }))
    );
  }, [allDistributors, isDistributorView, allowedLoginIds]);

  useEffect(() => {
    buildOptions();
  }, [buildOptions]);

  return (
    <CompactCheckboxDropdown
      label={config.label}
      options={options}
      selected={selectedValues}
      onChange={onChange}
      loading={loading}
      placeholder={config.label}
    />
  );
}
