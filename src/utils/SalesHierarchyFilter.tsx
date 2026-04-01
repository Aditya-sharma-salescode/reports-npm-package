import React, { useEffect, useRef, useState } from 'react';
import type { SalesHierarchyFilter as SalesHierarchyFilterConfig } from '../types/mdmReportsUtils';
import { fetchUsersByDesignation } from '../services/reportsDataService';
import '../components/HierarchyDropdown.css';

interface SalesHierarchyFilterProps {
  config: SalesHierarchyFilterConfig;
  selectedLevel: string | null;
  selectedValues: string[];
  onApply: (level: string, values: string[]) => void;
  onReset: () => void;
  onClose: () => void;
}

export function SalesHierarchyFilter({
  config,
  selectedLevel,
  selectedValues,
  onApply,
  onReset,
  onClose,
}: SalesHierarchyFilterProps) {
  const levels = config.hierarchyOrder ?? [];
  const [activeLevel, setActiveLevel] = useState<string | null>(selectedLevel ?? (levels[0] || null));
  const [levelValues, setLevelValues] = useState<Record<string, { label: string; value: string }[]>>({});
  const [loadingLevel, setLoadingLevel] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<string[]>(selectedValues);
  const [search, setSearch] = useState('');

  // Load values for initial active level
  useEffect(() => {
    if (activeLevel) loadLevelValues(activeLevel);
  }, []);

  async function loadLevelValues(level: string) {
    if (levelValues[level]) return;
    setLoadingLevel(level);
    try {
      const users = await fetchUsersByDesignation(level);
      setLevelValues(prev => ({
        ...prev,
        [level]: users.map(u => ({ label: (u.name as string) || u.loginId, value: u.userId })),
      }));
    } catch {
      setLevelValues(prev => ({ ...prev, [level]: [] }));
    } finally {
      setLoadingLevel(null);
    }
  }

  function handleLevelClick(level: string) {
    setActiveLevel(level);
    setLocalValues([]);
    setSearch('');
    loadLevelValues(level);
  }

  function toggleValue(val: string) {
    setLocalValues(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  }

  const currentOptions = activeLevel ? (levelValues[activeLevel] ?? []) : [];
  const filteredLevels = search
    ? levels.filter(l => l.toLowerCase().includes(search.toLowerCase()))
    : levels;
  const filteredValues = search
    ? currentOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : currentOptions;

  return (
    <div className="sc-hierarchy-popup" onClick={e => e.stopPropagation()}>
      <div className="sc-hierarchy-popup-search">
        <input
          placeholder="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className="sc-hierarchy-popup-body">
        {/* Left: levels */}
        <div className="sc-hierarchy-levels-col">
          {filteredLevels.map(level => (
            <div
              key={level}
              className={`sc-hierarchy-level-item${activeLevel === level ? ' active' : ''}`}
              onClick={() => handleLevelClick(level)}
            >
              {level}
            </div>
          ))}
        </div>

        {/* Right: values */}
        <div className="sc-hierarchy-values-col">
          {!activeLevel ? (
            <div className="sc-hierarchy-empty">Select a level from the left</div>
          ) : loadingLevel === activeLevel ? (
            <div className="sc-hierarchy-loading">Loading...</div>
          ) : filteredValues.length === 0 ? (
            <div className="sc-hierarchy-empty">No options available</div>
          ) : (
            filteredValues.map(opt => (
              <div
                key={opt.value}
                className="sc-hierarchy-value-item"
                onClick={() => toggleValue(opt.value)}
              >
                <input
                  type="checkbox"
                  checked={localValues.includes(opt.value)}
                  onChange={() => toggleValue(opt.value)}
                  onClick={e => e.stopPropagation()}
                />
                {opt.label}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sc-hierarchy-popup-footer">
        <button className="sc-btn-reset-sm" onClick={() => { onReset(); onClose(); }}>
          Reset
        </button>
        <button
          className="sc-btn-apply-sm"
          onClick={() => {
            if (activeLevel) onApply(activeLevel, localValues);
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
