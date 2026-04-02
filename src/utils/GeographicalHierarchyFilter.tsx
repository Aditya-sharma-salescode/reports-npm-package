import React, { useEffect, useMemo, useState } from 'react';
import type { newReportConfig } from '../types/mdmReportsUtils';
import '../components/HierarchyDropdown.css';

interface GeographicalHierarchyFilterProps {
  selectedReport: newReportConfig;
  filters: Record<string, string[]>;
  optionsMap: Record<string, { label: string; value: string }[]>;
  loadingMap: Record<string, boolean>;
  onLevelChange: (value: string | null) => void;
  onValueChange: (values: string[]) => void;
  onLoadLevels: () => void;
  onNextLevel?: () => void;
  isLastLevel?: boolean;
  onDropdownClose?: () => void;
  onResetAll?: () => void;
}

export function GeographicalHierarchyFilter({
  selectedReport,
  filters,
  optionsMap,
  loadingMap,
  onLevelChange,
  onValueChange,
  onLoadLevels,
  onNextLevel,
  isLastLevel = false,
  onDropdownClose,
  onResetAll,
}: GeographicalHierarchyFilterProps) {
  const isEnabled = !!selectedReport?.geographicalHierarchyFilter?.enabled;
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isEnabled) onLoadLevels();
  }, [isEnabled, onLoadLevels]);

  const levelKey = selectedReport?.geographicalHierarchyFilter?.levelFilterField || '';
  const currentLevel = filters[levelKey]?.[0];
  const valueKey = currentLevel || '';
  const currentValues = filters[valueKey] || [];

  const levelOptions = useMemo(() => {
    return (optionsMap[levelKey] || []).map(o => o.value);
  }, [optionsMap, levelKey]);

  const options = useMemo(() => optionsMap[valueKey] || [], [optionsMap, valueKey]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const lowered = searchTerm.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(lowered));
  }, [options, searchTerm]);

  const allOptionValues = useMemo(() => options.map(o => o.value), [options]);
  const isAllSelected = allOptionValues.length > 0 && allOptionValues.every(v => currentValues.includes(v));

  function handleOptionToggle(optionValue: string) {
    if (!currentLevel) return;
    const updated = currentValues.includes(optionValue)
      ? currentValues.filter(v => v !== optionValue)
      : [...currentValues, optionValue];
    onValueChange(updated);
  }

  function handleSelectAllToggle() {
    if (!currentLevel) return;
    onValueChange(isAllSelected ? [] : allOptionValues);
  }

  function handleReset() {
    setSearchTerm('');
    if (onResetAll) {
      onResetAll();
    } else {
      if (currentLevel) onValueChange([]);
      onLevelChange(null);
    }
  }

  function handleApply() {
    if (onNextLevel) onNextLevel();
    onDropdownClose?.();
  }

  if (!isEnabled) return null;

  return (
    <div className="sc-hierarchy-popup" onClick={e => e.stopPropagation()}>
      <div className="sc-hierarchy-popup-search">
        <input
          placeholder="Search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          disabled={!currentLevel}
          autoFocus
        />
      </div>

      <div className="sc-hierarchy-popup-body">
        {/* Left: levels */}
        <div className="sc-hierarchy-levels-col">
          {levelOptions.map(level => (
            <div
              key={level}
              className={`sc-hierarchy-level-item${currentLevel === level ? ' active' : ''}`}
              onClick={() => onLevelChange(level)}
            >
              {level}
            </div>
          ))}
        </div>

        {/* Right: values */}
        <div className="sc-hierarchy-values-col">
          {!currentLevel ? (
            <div className="sc-hierarchy-empty">Select a level to view locations</div>
          ) : loadingMap[valueKey] ? (
            <div className="sc-hierarchy-loading">
              <div className="sc-hierarchy-spinner" />
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="sc-hierarchy-empty">No options available</div>
          ) : (
            <>
              <div className="sc-hierarchy-value-item" onClick={handleSelectAllToggle} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAllToggle}
                  onClick={e => e.stopPropagation()}
                />
                <span style={{ fontWeight: 500 }}>Select all</span>
              </div>
              {filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  className="sc-hierarchy-value-item"
                  onClick={() => handleOptionToggle(opt.value)}
                >
                  <input
                    type="checkbox"
                    checked={currentValues.includes(opt.value)}
                    onChange={() => handleOptionToggle(opt.value)}
                    onClick={e => e.stopPropagation()}
                  />
                  <span>{opt.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="sc-hierarchy-popup-footer">
        <button className="sc-btn-reset-sm" onClick={handleReset}>Reset</button>
        <button className="sc-btn-apply-sm" onClick={handleApply} disabled={!currentLevel}>Apply</button>
      </div>
    </div>
  );
}
