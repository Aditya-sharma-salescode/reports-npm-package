import React, { useEffect, useState } from 'react';
import { CompactCheckboxDropdown } from '../components/CompactCheckboxDropdown';
import type { SalesHierarchyFilter as SalesHierarchyFilterConfig } from '../types/mdmReportsUtils';
import type { DrillDownPathItem } from '../services/types';
import { fetchSalesDesignations, fetchUsersByDesignation, fetchChildrenUsers } from '../services/reportsDataService';
import { summarizeDrillDownPath } from './hierarchyHelpers';

interface SalesHierarchyFilterProps {
  config: SalesHierarchyFilterConfig;
  drillDownPath: DrillDownPathItem[];
  onPathChange: (path: DrillDownPathItem[]) => void;
  onSelectedValuesChange: (values: string[]) => void;
  selectedValues: string[];
}

interface LevelState {
  designation: string;
  options: { label: string; value: string }[];
  selected: string[];
  loading: boolean;
}

export function SalesHierarchyFilter({
  config,
  drillDownPath,
  onPathChange,
  onSelectedValuesChange,
  selectedValues,
}: SalesHierarchyFilterProps) {
  const [levels, setLevels] = useState<LevelState[]>([]);
  const [rootDesignations, setRootDesignations] = useState<{ label: string; value: string }[]>([]);
  const [selectedRootDesignation, setSelectedRootDesignation] = useState<string>('');
  const [rootLoading, setRootLoading] = useState(false);

  useEffect(() => {
    loadRootDesignations();
  }, []);

  async function loadRootDesignations() {
    setRootLoading(true);
    try {
      const designations = await fetchSalesDesignations('root');
      setRootDesignations(designations.map((d: string) => ({ label: d.toUpperCase(), value: d })));
    } finally {
      setRootLoading(false);
    }
  }

  async function handleDesignationSelect(designation: string) {
    setSelectedRootDesignation(designation);
    const newLevel: LevelState = {
      designation,
      options: [],
      selected: [],
      loading: true,
    };
    setLevels([newLevel]);
    onPathChange([]);
    onSelectedValuesChange([]);

    try {
      const users = await fetchUsersByDesignation(designation);
      setLevels([{
        designation,
        options: users.map((u) => ({ label: u.name || u.loginId, value: u.userId })),
        selected: [],
        loading: false,
      }]);
    } catch {
      setLevels((prev) => prev.map((l, i) => i === 0 ? { ...l, loading: false } : l));
    }
  }

  async function handleLevelSelectionChange(levelIndex: number, selected: string[]) {
    // Update selection at this level
    setLevels((prev) =>
      prev.map((l, i) => i === levelIndex ? { ...l, selected } : i > levelIndex ? { ...l, selected: [], options: [] } : l).slice(0, levelIndex + 1)
    );

    // Update drill-down path: keep up to this level
    const currentPath = drillDownPath.slice(0, levelIndex);
    const currentLevel = levels[levelIndex];
    const newPath: DrillDownPathItem[] = [
      ...currentPath,
      ...selected.map((v) => ({ level: currentLevel.designation, value: v })),
    ];
    onPathChange(newPath);
    onSelectedValuesChange(selected);

    // If single selection, load children
    if (selected.length === 1) {
      const hierarchyOrder = config.hierarchyOrder ?? [];
      const currentIdx = hierarchyOrder.indexOf(currentLevel.designation);
      const nextDesignation = currentIdx >= 0 && currentIdx < hierarchyOrder.length - 1
        ? hierarchyOrder[currentIdx + 1]
        : null;

      if (nextDesignation) {
        const childLevel: LevelState = {
          designation: nextDesignation,
          options: [],
          selected: [],
          loading: true,
        };
        setLevels((prev) => [...prev.slice(0, levelIndex + 1), childLevel]);
        try {
          const children = await fetchChildrenUsers(selected[0], nextDesignation);
          setLevels((prev) =>
            prev.map((l, i) =>
              i === levelIndex + 1
                ? {
                    ...l,
                    options: children.map((u) => ({ label: u.name || u.loginId, value: u.userId })),
                    loading: false,
                  }
                : l
            )
          );
        } catch {
          setLevels((prev) =>
            prev.map((l, i) => i === levelIndex + 1 ? { ...l, loading: false } : l)
          );
        }
      }
    }
  }

  const summary = summarizeDrillDownPath(drillDownPath);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Root designation selector */}
      <CompactCheckboxDropdown
        label={config.levelFilterLabel}
        options={rootDesignations}
        selected={selectedRootDesignation ? [selectedRootDesignation] : []}
        onChange={(vals) => {
          if (vals[0]) handleDesignationSelect(vals[0]);
          else {
            setSelectedRootDesignation('');
            setLevels([]);
            onPathChange([]);
            onSelectedValuesChange([]);
          }
        }}
        loading={rootLoading}
        searchable={false}
        maxSelected={1}
        placeholder={config.levelFilterLabel}
      />

      {/* Drill-down levels */}
      {levels.map((level, idx) => (
        <CompactCheckboxDropdown
          key={`${level.designation}-${idx}`}
          label={`${level.designation.toUpperCase()} Values`}
          options={level.options}
          selected={level.selected}
          onChange={(vals) => handleLevelSelectionChange(idx, vals)}
          loading={level.loading}
          placeholder={`Select ${level.designation.toUpperCase()}`}
        />
      ))}

      {/* Summary */}
      {summary.length > 0 && (
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          {summary.map((s) => (
            <span key={s.level} style={{ marginRight: 8 }}>
              {s.count} {s.level}{s.count > 1 ? 's' : ''} selected
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
