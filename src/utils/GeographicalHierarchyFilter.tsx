import React, { useEffect, useState } from 'react';
import { CompactCheckboxDropdown } from '../components/CompactCheckboxDropdown';
import type { GeographicalHierarchyFilter as GeoConfig } from '../types/mdmReportsUtils';
import type { DrillDownPathItem } from '../services/types';
import {
  fetchGeographicalLevels,
  fetchGeographicalLocations,
  fetchGeographicalLocationsUnder,
} from '../services/reportsDataService';
import { summarizeDrillDownPath } from './hierarchyHelpers';

interface GeographicalHierarchyFilterProps {
  config: GeoConfig;
  drillDownPath: DrillDownPathItem[];
  onPathChange: (path: DrillDownPathItem[]) => void;
  onSelectedValuesChange: (values: string[]) => void;
  selectedValues: string[];
}

interface LevelState {
  level: string;
  options: { label: string; value: string }[];
  selected: string[];
  loading: boolean;
}

export function GeographicalHierarchyFilter({
  config,
  drillDownPath,
  onPathChange,
  onSelectedValuesChange,
  selectedValues,
}: GeographicalHierarchyFilterProps) {
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [selectedRootLevel, setSelectedRootLevel] = useState<string>('');
  const [levels, setLevels] = useState<LevelState[]>([]);

  useEffect(() => {
    loadLevels();
  }, []);

  async function loadLevels() {
    setLevelsLoading(true);
    try {
      const fromApi = await fetchGeographicalLevels();
      // Use config hierarchyOrder if provided, otherwise use API order
      const order = config.hierarchyOrder ?? fromApi;
      setAvailableLevels(order);
    } finally {
      setLevelsLoading(false);
    }
  }

  async function handleRootLevelSelect(level: string) {
    setSelectedRootLevel(level);
    setLevels([{ level, options: [], selected: [], loading: true }]);
    onPathChange([]);
    onSelectedValuesChange([]);

    try {
      const locations = await fetchGeographicalLocations(level);
      setLevels([{
        level,
        options: locations.map((l) => ({ label: l.label || l.value, value: l.value })),
        selected: [],
        loading: false,
      }]);
    } catch {
      setLevels((prev) => prev.map((l, i) => i === 0 ? { ...l, loading: false } : l));
    }
  }

  async function handleLevelSelectionChange(levelIndex: number, selected: string[]) {
    setLevels((prev) =>
      prev
        .map((l, i) => (i === levelIndex ? { ...l, selected } : i > levelIndex ? { ...l, selected: [], options: [] } : l))
        .slice(0, levelIndex + 1)
    );

    const currentLevel = levels[levelIndex];
    const newPath: DrillDownPathItem[] = [
      ...drillDownPath.slice(0, levelIndex),
      ...selected.map((v) => ({ level: currentLevel.level, value: v })),
    ];
    onPathChange(newPath);
    onSelectedValuesChange(selected);

    // Drill down if single selection
    if (selected.length === 1) {
      const hierarchyOrder = config.hierarchyOrder ?? availableLevels;
      const currentIdx = hierarchyOrder.indexOf(currentLevel.level);
      const nextLevel =
        currentIdx >= 0 && currentIdx < hierarchyOrder.length - 1
          ? hierarchyOrder[currentIdx + 1]
          : null;

      if (nextLevel) {
        const childLevel: LevelState = {
          level: nextLevel,
          options: [],
          selected: [],
          loading: true,
        };
        setLevels((prev) => [...prev.slice(0, levelIndex + 1), childLevel]);
        try {
          const locations = await fetchGeographicalLocationsUnder(
            currentLevel.level,
            selected[0],
            nextLevel
          );
          setLevels((prev) =>
            prev.map((l, i) =>
              i === levelIndex + 1
                ? {
                    ...l,
                    options: locations.map((loc) => ({
                      label: loc.label || loc.value,
                      value: loc.value,
                    })),
                    loading: false,
                  }
                : l
            )
          );
        } catch {
          setLevels((prev) =>
            prev.map((l, i) => (i === levelIndex + 1 ? { ...l, loading: false } : l))
          );
        }
      }
    }
  }

  const levelOptions = (config.hierarchyOrder ?? availableLevels).map((l) => ({
    label: l.charAt(0).toUpperCase() + l.slice(1),
    value: l,
  }));

  const summary = summarizeDrillDownPath(drillDownPath);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <CompactCheckboxDropdown
        label={config.levelFilterLabel}
        options={levelOptions}
        selected={selectedRootLevel ? [selectedRootLevel] : []}
        onChange={(vals) => {
          if (vals[0]) handleRootLevelSelect(vals[0]);
          else {
            setSelectedRootLevel('');
            setLevels([]);
            onPathChange([]);
            onSelectedValuesChange([]);
          }
        }}
        loading={levelsLoading}
        searchable={false}
        maxSelected={1}
        placeholder={config.levelFilterLabel}
      />

      {levels.map((level, idx) => (
        <CompactCheckboxDropdown
          key={`${level.level}-${idx}`}
          label={`${level.level.charAt(0).toUpperCase() + level.level.slice(1)} Values`}
          options={level.options}
          selected={level.selected}
          onChange={(vals) => handleLevelSelectionChange(idx, vals)}
          loading={level.loading}
          placeholder={`Select ${level.level}`}
        />
      ))}

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
