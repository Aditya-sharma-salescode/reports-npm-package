import { useState, useEffect, useRef, useCallback } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { NewDateFilter } from '../date/NewDateFilter';
import { GSTRMonthYearPicker } from '../date/GSTRMonthYearPicker';
import { SalesHierarchyFilter } from '../utils/SalesHierarchyFilter';
import { GeographicalHierarchyFilter } from '../utils/GeographicalHierarchyFilter';
import { TopFilterBar } from '../components/TopFilterBar';
import { CompactCheckboxDropdown } from '../components/CompactCheckboxDropdown';
import { useHierarchyLoaders } from '../hooks/useHierarchyLoaders';
import { loadCustomFiltersForReport } from '../services/mdmCustomFiltersService';
import { fetchFilterValues, fetchLocationUsers, fetchChildrenUsers } from '../services/reportsDataService';
import { fetchDistributorMeta, filterDistributorsBySelections } from '../services/distributorMetaService';
import { downloadReport, buildLocationFilters, buildUserFilters } from '../services/mdmReportsDownloadService';
import type { newReportConfig } from '../types/mdmReportsUtils';
import type { FilterOption, DrillDownPathItem, DistributorFeature } from '../services/types';
import { MdmReportsPreview } from './MdmReportsPreview';
import './MdmReportsFilter.css';

interface MdmReportsNewFilterProps {
  reportConfig: newReportConfig;
  onBack: () => void;
  reportCards?: newReportConfig[];
  onSelectReport?: (config: newReportConfig) => void;
}

function isNoPreviewReport(config: newReportConfig) {
  return config.isLiveReport || config.isGSTRReport || config.isPDFReport || config.customDownload;
}

type DistributorSource = 'geographical' | 'sales';

const resolveDefaultDistributorSource = (report: newReportConfig): DistributorSource => {
  if (report.geographicalHierarchyFilter?.enabled) return 'geographical';
  if (report.salesHierarchyFilter?.enabled) return 'sales';
  return 'geographical';
};

export function MdmReportsNewFilter({ reportConfig, onBack, reportCards, onSelectReport }: MdmReportsNewFilterProps) {
  // ── Report switcher dropdown ──────────────────────────────────────────────
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const reportDropdownRef = useRef<HTMLDivElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // ── Centralized state (matches original's pattern) ─────────────────────────
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [optionsMap, setOptionsMap] = useState<Record<string, { label: string; value: string }[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [salesDrillDownPath, setSalesDrillDownPath] = useState<DrillDownPathItem[]>([]);
  const [geoDrillDownPath, setGeoDrillDownPath] = useState<DrillDownPathItem[]>([]);
  const [geoHierarchyOrder, setGeoHierarchyOrder] = useState<string[]>([]);
  const [salesOptionsCache, setSalesOptionsCache] = useState<Record<string, { label: string; value: string }[]>>({});
  const [geoOptionsCache, setGeoOptionsCache] = useState<Record<string, { label: string; value: string }[]>>({});

  // Distributor
  const [distributorFeatures, setDistributorFeatures] = useState<DistributorFeature[]>([]);
  const [distributorSource, setDistributorSource] = useState<DistributorSource>(resolveDefaultDistributorSource(reportConfig));

  // Custom filters
  const [customFilters, setCustomFilters] = useState<FilterOption[]>([]);
  const [customFiltersLoading, setCustomFiltersLoading] = useState(false);
  const [customFilterSelectionOrder, setCustomFilterSelectionOrder] = useState<string[]>([]);

  // Date
  const [fromDate, setFromDate] = useState<Dayjs>(dayjs());
  const [toDate, setToDate] = useState<Dayjs>(dayjs());
  const [dateFilterKey, setDateFilterKey] = useState(0);

  // UI
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isHierarchySyncing, setIsHierarchySyncing] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const salesApplyJustClicked = useRef(false);
  const geoApplyJustClicked = useRef(false);

  const selectedReport = reportConfig;
  const noPreview = isNoPreviewReport(reportConfig);
  const salesConfig = reportConfig.salesHierarchyFilter;
  const geoConfig = reportConfig.geographicalHierarchyFilter;
  const distConfig = reportConfig.distributorFilter;
  const isDistributorView = reportConfig.isDistributorView;
  const distributorFieldKey = distConfig?.field;

  const geoEnabled = !!geoConfig?.enabled;
  const salesEnabled = !!salesConfig?.enabled;
  const showToggle = geoEnabled && salesEnabled;
  const isGeoActive = geoEnabled && (!showToggle || distributorSource === 'geographical');
  const isSalesActive = salesEnabled && (!showToggle || distributorSource === 'sales');

  // ── Hierarchy loaders (matches original's useHierarchyLoaders) ────────────
  const {
    loadSalesLevels,
    loadSalesValues,
    loadGeographicalLevels,
    loadGeographicalValues,
  } = useHierarchyLoaders({
    selectedReport,
    filters,
    setOptionsMap,
    setLoadingMap,
    salesDrillDownPath,
    geoDrillDownPath,
    geoHierarchyOrder,
    setGeoHierarchyOrder,
    salesOptionsCache,
    setSalesOptionsCache,
    geoOptionsCache,
    setGeoOptionsCache,
  });

  // ── Derived state ─────────────────────────────────────────────────────────
  const hasSalesDrillDown = salesDrillDownPath.length > 0;
  const hasGeoDrillDown = geoDrillDownPath.length > 0;
  const hasDirectDistributor = distributorFieldKey ? (filters[distributorFieldKey]?.length > 0) : false;
  const hasFilters = hasSalesDrillDown || hasGeoDrillDown || hasDirectDistributor || isDistributorView;
  const validationDisabled = reportConfig.disableValidation !== false;
  const isPreviewDisabled = validationDisabled ? false : !hasFilters;
  const isDownloadDisabled = validationDisabled ? false : !hasFilters;

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (salesConfig?.enabled) loadSalesLevels();
  }, [salesConfig?.enabled, loadSalesLevels]);

  useEffect(() => {
    if (geoConfig?.enabled) loadGeographicalLevels();
  }, [geoConfig?.enabled, loadGeographicalLevels]);

  useEffect(() => {
    fetchDistributorMeta().then(meta => {
      setDistributorFeatures(meta.features);
      const typeOpts = meta.types.map(t => ({ label: t, value: t }));
      const divOpts = meta.divisions.map(d => ({ label: d, value: d }));
      setOptionsMap(prev => ({ ...prev, distributor_type: typeOpts, distributor_division: divOpts }));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const loadCustom = async () => {
      setCustomFiltersLoading(true);
      try {
        const cf = await loadCustomFiltersForReport(reportConfig);
        setCustomFilters(cf);
      } finally {
        setCustomFiltersLoading(false);
      }
    };
    loadCustom();
  }, [reportConfig]);

  // Close report dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (reportDropdownRef.current && !reportDropdownRef.current.contains(e.target as Node)) {
        setReportDropdownOpen(false);
        setReportSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close download menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) setDownloadMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Clear distributor when hierarchy/type/division changes
  useEffect(() => {
    if (distConfig?.enabled && distributorFieldKey) {
      setOptionsMap(prev => { const u = { ...prev }; delete u[distributorFieldKey]; return u; });
      setFilters(prev => { const u = { ...prev }; delete u[distributorFieldKey]; return u; });
    }
  }, [
    distConfig?.enabled,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(geoDrillDownPath),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(salesDrillDownPath),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters['distributor_type']),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters['distributor_division']),
    distributorSource,
  ]);

  // ── Helpers for clearing custom filters / distributor ────────────────────────
  const clearDistributorSelections = useCallback(() => {
    if (!distributorFieldKey) return;
    setFilters(prev => {
      const next = { ...prev };
      delete next[distributorFieldKey];
      return next;
    });
    setOptionsMap(prev => {
      const u = { ...prev };
      delete u[distributorFieldKey];
      return u;
    });
  }, [distributorFieldKey]);

  // ── Hierarchy handlers (matching original) ─────────────────────────────────

  const handleSalesLevelChange = useCallback((level: string | null) => {
    if (!salesConfig) return;
    const levelKey = salesConfig.levelFilterField;
    setFilters(prev => {
      const next = { ...prev };
      if (level) {
        next[levelKey] = [level];
      } else {
        delete next[levelKey];
      }
      return next;
    });
    if (level) loadSalesValues(level);
  }, [salesConfig, loadSalesValues]);

  const handleSalesValueChange = useCallback((values: string[]) => {
    if (!salesConfig) return;
    const currentLevel = filters[salesConfig.levelFilterField]?.[0];
    if (currentLevel) {
      setFilters(prev => ({ ...prev, [currentLevel]: values }));
    }
  }, [salesConfig, filters]);

  const handleSalesNextLevel = useCallback(() => {
    if (!salesConfig) return;
    const hierarchyOrder = salesConfig.hierarchyOrder || [];
    const levelKey = salesConfig.levelFilterField;
    const currentLevel = filters[levelKey]?.[0];
    if (!currentLevel) return;

    const currentValues = filters[currentLevel] || [];
    if (currentValues.length === 0) return;

    salesApplyJustClicked.current = true;
    setIsHierarchySyncing(true);

    // Build the full drill-down path up to current level
    const newPathItems: DrillDownPathItem[] = currentValues.map(v => ({ level: currentLevel, value: v }));
    const newPath = [...salesDrillDownPath.filter(p => p.level !== currentLevel), ...newPathItems];
    setSalesDrillDownPath(newPath);

    const currentIdx = hierarchyOrder.indexOf(currentLevel);
    const supplierLevel = hierarchyOrder[hierarchyOrder.length - 1] || 'supplier';
    const isSupplierLevelChange = currentLevel === supplierLevel;

    // Clear child level options/cache
    if (currentIdx !== -1) {
      setOptionsMap(prev => {
        const u = { ...prev };
        for (let i = currentIdx + 1; i < hierarchyOrder.length; i++) delete u[hierarchyOrder[i]];
        if (isSupplierLevelChange) customFilters.forEach(cf => delete u[cf.alias]);
        return u;
      });
      setSalesOptionsCache(prev => {
        const u = { ...prev };
        for (let i = currentIdx + 1; i < hierarchyOrder.length; i++) delete u[hierarchyOrder[i]];
        return u;
      });
      setFilters(prev => {
        const next = { ...prev };
        delete next[levelKey];
        delete next[currentLevel];
        for (let i = currentIdx + 1; i < hierarchyOrder.length; i++) delete next[hierarchyOrder[i]];
        if (isSupplierLevelChange) {
          customFilters.forEach(cf => delete next[cf.alias]);
          Object.keys(selectedReport.mergedFilters ?? {}).forEach(mf => {
            delete next[mf]; delete next[`${mf}_dynamic`];
          });
        }
        return next;
      });
      if (isSupplierLevelChange) setCustomFilterSelectionOrder([]);
    }

    // Move to next level
    const nextLevel = currentIdx >= 0 && currentIdx < hierarchyOrder.length - 2
      ? hierarchyOrder[currentIdx + 1]
      : null;

    if (nextLevel && nextLevel !== 'supplier') {
      setFilters(prev => ({ ...prev, [levelKey]: [nextLevel] }));
      loadSalesValues(nextLevel);
    }

    // Clear distributor selections on apply
    if (distributorSource === 'sales') clearDistributorSelections();

    setIsHierarchySyncing(false);
    loadSalesLevels();
  }, [salesConfig, filters, salesDrillDownPath, loadSalesValues, loadSalesLevels, customFilters, selectedReport, distributorSource, clearDistributorSelections]);

  // Revert uncommitted sales filter changes on dropdown close (matching original)
  const handleSalesDropdownClose = useCallback(() => {
    if (!salesConfig) return;
    if (salesApplyJustClicked.current) {
      salesApplyJustClicked.current = false;
      setIsHierarchySyncing(false);
      return;
    }
    const hierarchyOrder = salesConfig.hierarchyOrder || [];
    const levelKey = salesConfig.levelFilterField;
    const getValuesFromPath = (path: DrillDownPathItem[], level: string) =>
      path.filter(item => item.level === level).map(item => item.value);

    setFilters(prev => {
      const next = { ...prev };
      let changed = false;
      hierarchyOrder.forEach(level => {
        const filterValues = prev[level] || [];
        const committedValues = getValuesFromPath(salesDrillDownPath, level);
        if (filterValues.length > 0 && committedValues.length === 0) {
          delete next[level]; changed = true;
        } else if (filterValues.length > 0 && JSON.stringify([...filterValues].sort()) !== JSON.stringify([...committedValues].sort())) {
          if (committedValues.length > 0) { next[level] = [...committedValues]; } else { delete next[level]; }
          changed = true;
        }
      });
      if (salesDrillDownPath.length === 0 && next[levelKey]) { delete next[levelKey]; changed = true; }
      return changed ? next : prev;
    });
    setOptionsMap(prev => {
      const u = { ...prev }; let changed = false;
      hierarchyOrder.forEach(level => {
        if (getValuesFromPath(salesDrillDownPath, level).length === 0 && u[level]) { delete u[level]; changed = true; }
      });
      return changed ? u : prev;
    });
    setSalesOptionsCache(prev => {
      const u = { ...prev }; let changed = false;
      hierarchyOrder.forEach(level => {
        if (getValuesFromPath(salesDrillDownPath, level).length === 0 && u[level]) { delete u[level]; changed = true; }
      });
      return changed ? u : prev;
    });
    setIsHierarchySyncing(false);
  }, [salesConfig, salesDrillDownPath]);

  const handleSalesResetAll = useCallback(() => {
    if (!salesConfig) return;
    const levelKey = salesConfig.levelFilterField;
    const hierarchyOrder = salesConfig.hierarchyOrder || [];
    setFilters(prev => {
      const next = { ...prev };
      delete next[levelKey];
      hierarchyOrder.forEach(level => delete next[level]);
      // Also clear custom + merged filters
      customFilters.forEach(cf => delete next[cf.alias]);
      Object.keys(selectedReport.mergedFilters ?? {}).forEach(mf => {
        delete next[mf]; delete next[`${mf}_dynamic`];
      });
      return next;
    });
    setSalesDrillDownPath([]);
    setOptionsMap(prev => {
      const u = { ...prev };
      hierarchyOrder.forEach(level => delete u[level]);
      customFilters.forEach(cf => delete u[cf.alias]);
      Object.keys(selectedReport.mergedFilters ?? {}).forEach(mf => {
        delete u[mf];
        (selectedReport.mergedFilters?.[mf] || []).forEach(s => delete u[s.alias]);
      });
      return u;
    });
    setSalesOptionsCache({});
    setCustomFilterSelectionOrder([]);
    if (distributorSource === 'sales') clearDistributorSelections();
  }, [salesConfig, customFilters, selectedReport, distributorSource, clearDistributorSelections]);

  const handleGeoLevelChange = useCallback((level: string | null) => {
    if (!geoConfig) return;
    const levelKey = geoConfig.levelFilterField;
    setFilters(prev => {
      const next = { ...prev };
      if (level) {
        next[levelKey] = [level];
      } else {
        delete next[levelKey];
      }
      return next;
    });
    if (level) loadGeographicalValues(level);
  }, [geoConfig, loadGeographicalValues]);

  const handleGeoValueChange = useCallback((values: string[]) => {
    if (!geoConfig) return;
    const currentLevel = filters[geoConfig.levelFilterField]?.[0];
    if (currentLevel) {
      setFilters(prev => ({ ...prev, [currentLevel]: values }));
    }
  }, [geoConfig, filters]);

  const handleGeoNextLevel = useCallback(() => {
    if (!geoConfig) return;
    const levelKey = geoConfig.levelFilterField;
    const currentLevel = filters[levelKey]?.[0];
    if (!currentLevel) return;

    const currentValues = filters[currentLevel] || [];
    if (currentValues.length === 0) return;

    geoApplyJustClicked.current = true;
    setIsHierarchySyncing(true);

    // Add to drill-down path
    const newPathItems: DrillDownPathItem[] = currentValues.map(v => ({ level: currentLevel, value: v }));
    const newPath = [...geoDrillDownPath.filter(p => p.level !== currentLevel), ...newPathItems];
    setGeoDrillDownPath(newPath);

    const currentIdx = geoHierarchyOrder.indexOf(currentLevel);
    const isLastLevel = currentIdx === geoHierarchyOrder.length - 1;

    // Clear child level options/cache
    if (currentIdx !== -1) {
      setOptionsMap(prev => {
        const u = { ...prev };
        for (let i = currentIdx + 1; i < geoHierarchyOrder.length; i++) delete u[geoHierarchyOrder[i]];
        if (isLastLevel) customFilters.forEach(cf => delete u[cf.alias]);
        return u;
      });
      setGeoOptionsCache(prev => {
        const u = { ...prev };
        for (let i = currentIdx + 1; i < geoHierarchyOrder.length; i++) delete u[geoHierarchyOrder[i]];
        return u;
      });
      setFilters(prev => {
        const next = { ...prev };
        delete next[levelKey];
        delete next[currentLevel];
        for (let i = currentIdx + 1; i < geoHierarchyOrder.length; i++) delete next[geoHierarchyOrder[i]];
        if (isLastLevel) {
          customFilters.forEach(cf => delete next[cf.alias]);
          Object.keys(selectedReport.mergedFilters ?? {}).forEach(mf => {
            delete next[mf]; delete next[`${mf}_dynamic`];
          });
        }
        return next;
      });
      if (isLastLevel) setCustomFilterSelectionOrder([]);
    }

    // Move to next level
    const nextLevel = currentIdx >= 0 && currentIdx < geoHierarchyOrder.length - 1
      ? geoHierarchyOrder[currentIdx + 1]
      : null;

    if (nextLevel) {
      setFilters(prev => ({ ...prev, [levelKey]: [nextLevel] }));
      loadGeographicalValues(nextLevel);
    }

    // Clear distributor selections on apply
    if (distributorSource === 'geographical') clearDistributorSelections();

    setIsHierarchySyncing(false);
    loadGeographicalLevels();
  }, [geoConfig, filters, geoDrillDownPath, geoHierarchyOrder, loadGeographicalValues, loadGeographicalLevels, customFilters, selectedReport, distributorSource, clearDistributorSelections]);

  // Revert uncommitted geo filter changes on dropdown close (matching original)
  const handleGeoDropdownClose = useCallback(() => {
    if (!geoConfig) return;
    if (geoApplyJustClicked.current) {
      geoApplyJustClicked.current = false;
      setIsHierarchySyncing(false);
      return;
    }
    const levelKey = geoConfig.levelFilterField;
    const getValuesFromPath = (path: DrillDownPathItem[], level: string) =>
      path.filter(item => item.level === level).map(item => item.value);

    setFilters(prev => {
      const next = { ...prev };
      let changed = false;
      geoHierarchyOrder.forEach(level => {
        const filterValues = prev[level] || [];
        const committedValues = getValuesFromPath(geoDrillDownPath, level);
        if (filterValues.length > 0 && committedValues.length === 0) {
          delete next[level]; changed = true;
        } else if (filterValues.length > 0 && JSON.stringify([...filterValues].sort()) !== JSON.stringify([...committedValues].sort())) {
          if (committedValues.length > 0) { next[level] = [...committedValues]; } else { delete next[level]; }
          changed = true;
        }
      });
      if (geoDrillDownPath.length === 0 && next[levelKey]) { delete next[levelKey]; changed = true; }
      return changed ? next : prev;
    });
    setOptionsMap(prev => {
      const u = { ...prev }; let changed = false;
      geoHierarchyOrder.forEach(level => {
        if (getValuesFromPath(geoDrillDownPath, level).length === 0 && u[level]) { delete u[level]; changed = true; }
      });
      return changed ? u : prev;
    });
    setGeoOptionsCache(prev => {
      const u = { ...prev }; let changed = false;
      geoHierarchyOrder.forEach(level => {
        if (getValuesFromPath(geoDrillDownPath, level).length === 0 && u[level]) { delete u[level]; changed = true; }
      });
      return changed ? u : prev;
    });
    setIsHierarchySyncing(false);
  }, [geoConfig, geoDrillDownPath, geoHierarchyOrder]);

  const handleGeoResetAll = useCallback(() => {
    if (!geoConfig) return;
    const levelKey = geoConfig.levelFilterField;
    setFilters(prev => {
      const next = { ...prev };
      delete next[levelKey];
      geoHierarchyOrder.forEach(level => delete next[level]);
      // Also clear custom + merged filters
      customFilters.forEach(cf => delete next[cf.alias]);
      Object.keys(selectedReport.mergedFilters ?? {}).forEach(mf => {
        delete next[mf]; delete next[`${mf}_dynamic`];
      });
      return next;
    });
    setGeoDrillDownPath([]);
    setOptionsMap(prev => {
      const u = { ...prev };
      geoHierarchyOrder.forEach(level => delete u[level]);
      customFilters.forEach(cf => delete u[cf.alias]);
      Object.keys(selectedReport.mergedFilters ?? {}).forEach(mf => {
        delete u[mf];
        (selectedReport.mergedFilters?.[mf] || []).forEach(s => delete u[s.alias]);
      });
      return u;
    });
    setGeoOptionsCache({});
    setCustomFilterSelectionOrder([]);
    if (distributorSource === 'geographical') clearDistributorSelections();
  }, [geoConfig, geoHierarchyOrder, customFilters, selectedReport, distributorSource, clearDistributorSelections]);

  // ── Multi-filter change handler (with cascade logic matching original) ──────
  const handleMultiFilterChange = useCallback((key: string, values: string[]) => {
    const hierarchyOrder = salesConfig?.hierarchyOrder || [];
    const supplierLevel = hierarchyOrder.length > 0 ? hierarchyOrder[hierarchyOrder.length - 1] : 'supplier';

    const isDistributorChange = key === distributorFieldKey || key === supplierLevel
      || key === 'distributor_type' || key === 'distributor_division';
    const isCustomFilter = customFilters.some(cf => cf.alias === key);
    const hadSelections = filters[key]?.length > 0 && filters[key][0] !== '';
    const hasSelections = values.length > 0 && values[0] !== '';

    // Should clear distributor when type/division is emptied
    const shouldClearDistributor =
      (key === 'distributor_type' || key === 'distributor_division') &&
      values.length === 0 && distConfig?.enabled;

    // ── Custom filter selection order tracking ──────────────────────────────
    let updatedSelectionOrder = [...customFilterSelectionOrder];
    if (isCustomFilter) {
      if (!hasSelections && hadSelections) {
        updatedSelectionOrder = updatedSelectionOrder.filter(k => k !== key);
      } else if (hasSelections && !hadSelections) {
        if (!updatedSelectionOrder.includes(key)) updatedSelectionOrder.push(key);
      } else if (hasSelections && hadSelections) {
        if (!updatedSelectionOrder.includes(key)) updatedSelectionOrder.push(key);
      }
    }

    // ── Determine which downstream custom filters to clear ──────────────────
    const filtersToClear: string[] = [];
    if (isCustomFilter) {
      const currentIndex = customFilterSelectionOrder.indexOf(key);
      if (currentIndex !== -1) {
        filtersToClear.push(...customFilterSelectionOrder.slice(currentIndex + 1));
      }
    }

    setCustomFilterSelectionOrder(updatedSelectionOrder);

    // ── Update filters ──────────────────────────────────────────────────────
    setFilters(prev => {
      const next = { ...prev, [key]: values };

      // Clear distributor when type/division emptied
      if (shouldClearDistributor && distributorFieldKey) {
        delete next[distributorFieldKey];
      }

      // Distributor-level change → clear all custom + merged filters
      if (isDistributorChange) {
        customFilters.forEach(cf => delete next[cf.alias]);
        Object.keys(selectedReport.mergedFilters ?? {}).forEach(mf => {
          delete next[mf]; delete next[`${mf}_dynamic`];
        });
      }

      // Custom filter cascade: clear downstream
      if (filtersToClear.length > 0) {
        filtersToClear.forEach(k => delete next[k]);
      }

      return next;
    });

    // ── Clear options for affected keys ──────────────────────────────────────
    if (isDistributorChange) {
      setOptionsMap(prev => {
        const u = { ...prev };
        customFilters.forEach(cf => delete u[cf.alias]);
        Object.keys(selectedReport.mergedFilters ?? {}).forEach(mf => {
          delete u[mf];
          (selectedReport.mergedFilters?.[mf] || []).forEach(s => delete u[s.alias]);
        });
        return u;
      });
      setCustomFilterSelectionOrder([]);
    }

    if (shouldClearDistributor && distributorFieldKey) {
      setOptionsMap(prev => { const u = { ...prev }; delete u[distributorFieldKey]; return u; });
    }

    if (filtersToClear.length > 0) {
      setOptionsMap(prev => {
        const u = { ...prev };
        filtersToClear.forEach(k => delete u[k]);
        return u;
      });
    }

    // If a custom filter changed, invalidate other unselected custom filter options
    if (isCustomFilter) {
      const nextFilters = { ...filters, [key]: values };
      const filtersToInvalidate = customFilters
        .map(cf => cf.alias)
        .filter(alias => alias !== key)
        .filter(alias => {
          const vals = nextFilters[alias];
          return !vals || vals.length === 0 || vals[0] === '';
        });
      if (filtersToInvalidate.length > 0) {
        setOptionsMap(prev => {
          const u = { ...prev };
          filtersToInvalidate.forEach(alias => delete u[alias]);
          return u;
        });
      }
    }
  }, [filters, customFilters, customFilterSelectionOrder, salesConfig, distConfig, distributorFieldKey, selectedReport]);

  // ── Distributor source toggle ──────────────────────────────────────────────
  function handleDistributorSourceChange(source: DistributorSource) {
    if (source === distributorSource) return;
    if (source === 'geographical') {
      handleSalesResetAll();
    } else {
      handleGeoResetAll();
    }
    setDistributorSource(source);
  }

  // ── Load distributor options (matching original exactly) ───────────────────
  const loadDistributorOptions = useCallback(async (fieldKey: string) => {
    if (!selectedReport) return;
    setLoadingMap(prev => ({ ...prev, [fieldKey]: true }));
    try {
      let filterIds: string[] = [];
      let attemptedTargetedFetch = false;

      if (distributorSource === 'geographical' && geoConfig?.enabled && geoDrillDownPath.length > 0) {
        const level = geoDrillDownPath[geoDrillDownPath.length - 1].level;
        const values = geoDrillDownPath.filter(i => i.level === level).map(i => i.value);
        if (values.length > 0) {
          attemptedTargetedFetch = true;
          const results = await Promise.all(values.map(v => fetchLocationUsers(level, v, 'supplier')));
          filterIds = Array.from(new Set(results.flat().map(u => typeof u === 'string' ? u : u.loginId)));
        }
      }

      if (distributorSource === 'sales' && salesConfig?.enabled && salesDrillDownPath.length > 0) {
        const hierarchyOrder = salesConfig.hierarchyOrder || [];
        const supplierLevel = hierarchyOrder[hierarchyOrder.length - 1];
        const supplierSelections = salesDrillDownPath.filter(i => i.level === supplierLevel).map(i => i.value);

        if (supplierSelections.length > 0) {
          attemptedTargetedFetch = true;
          filterIds = supplierSelections;
        } else {
          const targetParent = [...salesDrillDownPath].reverse().find(item => {
            const li = hierarchyOrder.indexOf(item.level);
            const si = hierarchyOrder.indexOf(supplierLevel);
            return li !== -1 && si !== -1 && li < si;
          });
          if (targetParent) {
            attemptedTargetedFetch = true;
            const parentSelections = salesDrillDownPath.filter(i => i.level === targetParent.level).map(i => i.value);
            const results = await Promise.all(parentSelections.map(uid => fetchChildrenUsers(uid, supplierLevel)));
            filterIds = Array.from(new Set(results.flat().map(u => typeof u === 'string' ? u : u.loginId)));
          }
        }
      }

      if (filterIds.length === 0 && !attemptedTargetedFetch) {
        const loggedInUser = JSON.parse(localStorage.getItem('authContext') ?? '{}')?.user;
        const designation = loggedInUser?.designation || [];
        const userId = designation.some((d: string) => d.toLowerCase() === 'reportadmin')
          ? loggedInUser?.loginId
          : loggedInUser?.assignedHierarchy || loggedInUser?.loginId;
        if (userId) {
          const allSuppliers = await fetchChildrenUsers(userId, 'supplier');
          filterIds = allSuppliers.map(u => typeof u === 'string' ? u : u.loginId);
        }
      }

      const selectedTypes = filters['distributor_type'] || [];
      const selectedDivisions = filters['distributor_division'] || [];
      let filteredLoginIds: string[];
      if ((selectedTypes.length > 0 || selectedDivisions.length > 0) && distributorFeatures.length > 0) {
        filteredLoginIds = filterDistributorsBySelections(distributorFeatures, selectedTypes, selectedDivisions, filterIds.length > 0 ? filterIds : undefined);
      } else {
        filteredLoginIds = filterIds;
      }

      const opts = filteredLoginIds.map(u => ({ label: u, value: u }));
      setOptionsMap(prev => ({ ...prev, [fieldKey]: opts }));
    } catch {
      setOptionsMap(prev => ({ ...prev, [fieldKey]: [] }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [fieldKey]: false }));
    }
  }, [selectedReport, geoConfig, salesConfig, distributorSource, geoDrillDownPath, salesDrillDownPath, filters, distributorFeatures]);

  // ── Custom filter options ──────────────────────────────────────────────────
  const loadFilterOptions = useCallback(async (key: string) => {
    setLoadingMap(prev => ({ ...prev, [key]: true }));
    try {
      const locationFilters = buildLocationFilters(geoDrillDownPath);
      const userFilters = buildUserFilters(salesDrillDownPath, salesConfig?.hierarchyOrder || []);
      const distributorCodes = distributorFieldKey ? (filters[distributorFieldKey] || []) : [];

      const distributorFilterPayload = (locationFilters.length > 0 || userFilters.length > 0)
        ? { locationFilters: locationFilters.length > 0 ? locationFilters : undefined, userFilters: userFilters.length > 0 ? userFilters : undefined }
        : undefined;

      const additionalFilters: Record<string, string[]> | undefined = distributorCodes.length > 0
        ? { distributor_code: distributorCodes }
        : undefined;

      let since: string | undefined;
      let until: string | undefined;
      if (reportConfig.dateRangeFilter && fromDate && toDate) {
        since = new Date(Date.UTC(fromDate.year(), fromDate.month(), fromDate.date() - 1, 18, 30, 0)).toISOString().replace(/\.\d{3}Z$/, 'Z');
        until = new Date(Date.UTC(toDate.year(), toDate.month(), toDate.date(), 18, 29, 59)).toISOString().replace(/\.\d{3}Z$/, 'Z');
      }

      const values = await fetchFilterValues({
        report: reportConfig.filterReportName ?? reportConfig.reportName,
        which: key,
        additionalFilters,
        since,
        until,
        distributorFilter: distributorFilterPayload,
      });
      const opts = values.filter(v => v && String(v).trim() !== '').map(v => ({ label: String(v), value: String(v) }));
      setOptionsMap(prev => ({ ...prev, [key]: opts }));
    } catch {
      setOptionsMap(prev => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  }, [reportConfig, fromDate, toDate, geoDrillDownPath, salesDrillDownPath, salesConfig, filters, distributorFieldKey]);

  const handleFilterOpen = useCallback((key: string) => {
    if (key === distributorFieldKey) return;
    const hasOpts = optionsMap[key]?.length > 0;
    if (!hasOpts) loadFilterOptions(key);
  }, [distributorFieldKey, optionsMap, loadFilterOptions]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  function handleReset() {
    setFilters({});
    setSalesDrillDownPath([]);
    setGeoDrillDownPath([]);
    setSalesOptionsCache({});
    setGeoOptionsCache({});
    setShowPreview(false);
    setFromDate(dayjs()); setToDate(dayjs());
    setDateFilterKey(prev => prev + 1);
    // Re-populate type/division options
    setOptionsMap(prev => ({
      distributor_type: prev.distributor_type || [],
      distributor_division: prev.distributor_division || [],
    }));
  }

  function showNotif(msg: string, type: 'success' | 'error') {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }

  // ── Download ───────────────────────────────────────────────────────────────
  async function handleDownload(format: string) {
    setDownloading(true);
    setDownloadMenuOpen(false);
    try {
      // Build clean filters — only custom filter selections + distributor_code
      // Exclude all hierarchy-internal keys (levels, values, type, division)
      const excludeKeys = new Set<string>();
      if (salesConfig?.levelFilterField) excludeKeys.add(salesConfig.levelFilterField);
      if (salesConfig?.valueFilterField) excludeKeys.add(salesConfig.valueFilterField);
      if (geoConfig?.levelFilterField) excludeKeys.add(geoConfig.levelFilterField);
      if (geoConfig?.valueFilterField) excludeKeys.add(geoConfig.valueFilterField);
      (salesConfig?.hierarchyOrder || []).forEach(l => excludeKeys.add(l));
      geoHierarchyOrder.forEach(l => excludeKeys.add(l));
      excludeKeys.add('distributor_type');
      excludeKeys.add('distributor_division');

      const cleanFilters: Record<string, string[]> = {};
      for (const [key, values] of Object.entries(filters)) {
        if (excludeKeys.has(key)) continue;
        if (values && values.length > 0 && values[0] !== '') {
          cleanFilters[key] = values;
        }
      }

      await downloadReport({
        selectedReport: reportConfig,
        filters: cleanFilters,
        dateRangeType: 'daterange',
        fromDate,
        toDate,
        format,
        primaryFilter: null,
        customFilters: customFilters.map(f => f.alias),
        salesDrillDownPath,
        geoDrillDownPath,
      });
      showNotif('Downloaded successfully!', 'success');
    } catch (err) {
      showNotif(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }

  // ── Filter chips ───────────────────────────────────────────────────────────
  type Chip = { key: string; label: string; value: string; count?: number; onRemove: () => void };
  const chips: Chip[] = [];

  if (filters['distributor_type']?.length > 0) {
    const v = filters['distributor_type'];
    chips.push({ key: 'distributor_type', label: 'Distributor type', value: v[0], count: v.length > 1 ? v.length - 1 : undefined, onRemove: () => handleMultiFilterChange('distributor_type', []) });
  }
  if (filters['distributor_division']?.length > 0) {
    const v = filters['distributor_division'];
    chips.push({ key: 'distributor_division', label: 'Distributor division', value: v[0], count: v.length > 1 ? v.length - 1 : undefined, onRemove: () => handleMultiFilterChange('distributor_division', []) });
  }
  if (distributorFieldKey && filters[distributorFieldKey]?.length > 0) {
    const v = filters[distributorFieldKey];
    chips.push({ key: 'distributor', label: 'Distributor', value: v[0], count: v.length > 1 ? v.length - 1 : undefined, onRemove: () => handleMultiFilterChange(distributorFieldKey, []) });
  }
  // Geo drill-down chips
  if (geoDrillDownPath.length > 0) {
    const levelGroups = new Map<string, string[]>();
    geoDrillDownPath.forEach(p => {
      const arr = levelGroups.get(p.level) || [];
      arr.push(p.value);
      levelGroups.set(p.level, arr);
    });
    levelGroups.forEach((values, level) => {
      chips.push({ key: `geo_${level}`, label: level, value: values[0], count: values.length > 1 ? values.length - 1 : undefined, onRemove: () => handleGeoResetAll() });
    });
  }

  // Sales drill-down chips
  if (salesDrillDownPath.length > 0) {
    const levelGroups = new Map<string, string[]>();
    salesDrillDownPath.forEach(p => {
      const arr = levelGroups.get(p.level) || [];
      arr.push(p.value);
      levelGroups.set(p.level, arr);
    });
    levelGroups.forEach((values, level) => {
      chips.push({ key: `sales_${level}`, label: level, value: values[0], count: values.length > 1 ? values.length - 1 : undefined, onRemove: () => handleSalesResetAll() });
    });
  }

  // Custom filter chips
  customFilters.forEach(cf => {
    const v = filters[cf.alias];
    if (v?.length > 0) {
      chips.push({ key: `custom_${cf.alias}`, label: cf.display, value: v[0], count: v.length > 1 ? v.length - 1 : undefined, onRemove: () => handleMultiFilterChange(cf.alias, []) });
    }
  });

  const noPreviewText =
    reportConfig.isLiveReport ? 'Live reports cannot be previewed. Kindly download the report to continue.'
    : reportConfig.isPDFReport ? 'PDF reports cannot be previewed. Kindly download the report to continue.'
    : reportConfig.isGSTRReport ? 'GSTR reports cannot be previewed. Kindly download the report to continue.'
    : 'This report cannot be previewed. Kindly download the report to continue.';

  return (
    <div className="sc-report-page">
      {notification && <div className={`sc-notification ${notification.type}`}>{notification.msg}</div>}

      {/* ── Row 1: Back + Title + Date picker ── */}
      <div className="sc-report-header">
        <div className="sc-report-header-left">
          <button className="sc-back-btn" onClick={onBack} title="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div className="sc-report-title-wrap" ref={reportDropdownRef}>
            <div className="sc-report-title" onClick={() => { if (reportCards?.length) { setReportDropdownOpen(v => !v); setReportSearch(''); } }}>
              <h1>{reportConfig.name}</h1>
              <span className={`sc-title-chevron${reportDropdownOpen ? ' open' : ''}`}>
                {reportDropdownOpen ? '▴' : '▾'}
              </span>
            </div>
            {reportDropdownOpen && reportCards && onSelectReport && (() => {
              const searchFiltered = reportSearch.trim()
                ? reportCards.filter(c => c.name.toLowerCase().includes(reportSearch.toLowerCase()))
                : reportCards;
              const groups = searchFiltered.reduce<Record<string, newReportConfig[]>>((acc, card) => {
                const type = card.type || 'Reports';
                if (!acc[type]) acc[type] = [];
                acc[type].push(card);
                return acc;
              }, {});
              return (
                <div className="sc-report-switcher">
                  <div className="sc-report-switcher-header">
                    <span className="sc-report-switcher-label">Reports – {reportConfig.name}</span>
                  </div>
                  <div className="sc-report-switcher-list">
                    {Object.entries(groups).map(([groupName, reports]) => {
                      const isExpanded = expandedGroups[groupName] !== false;
                      return (
                        <div key={groupName} className="sc-report-switcher-group">
                          <div className="sc-report-switcher-group-header" onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !isExpanded }))}>
                            <span className="sc-report-switcher-group-name">{groupName}</span>
                            <span className={`sc-report-switcher-group-chevron${isExpanded ? ' open' : ''}`}>
                              {isExpanded ? '▴' : '▾'}
                            </span>
                          </div>
                          {isExpanded && reports.map(r => (
                            <div
                              key={r.id}
                              className={`sc-report-switcher-item${r.id === reportConfig.id ? ' active' : ''}`}
                              onClick={() => { onSelectReport(r); setReportDropdownOpen(false); setReportSearch(''); }}
                            >
                              <span className="sc-report-switcher-dash">–</span>
                              <span>{r.name}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {Object.keys(groups).length === 0 && (
                      <div className="sc-report-switcher-empty">No reports found</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="sc-report-header-right">
          {reportConfig.dateRangeFilter && (
            <div className="sc-date-wrap">
              <span className="sc-date-range-label">{reportConfig.isGSTRReport ? 'Month & Year' : 'Date Range'}</span>
              <span className="sc-date-range-asterisk">*</span>
              {reportConfig.isGSTRReport ? (
                <GSTRMonthYearPicker key={dateFilterKey} selectedMonth={null} selectedYear={null}
                  onChange={(m, y) => { setFromDate(dayjs().month(m).year(y).startOf('month')); setToDate(dayjs().month(m).year(y).endOf('month')); }}
                  yearsRange={reportConfig.gstrYearsRange ?? 3} />
              ) : (
                <NewDateFilter key={dateFilterKey} fromDate={fromDate} toDate={toDate}
                  onFromChange={setFromDate} onToChange={setToDate} dateRangeAllowed={reportConfig.dateRangeAllowed} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: TopFilterBar + Preview + Download ── */}
      <div className="sc-filter-bar-row">
        <div className="sc-filter-bar-flex">
          {!isDistributorView && (
            <TopFilterBar
              selectedReport={reportConfig}
              distributorTypeOptions={optionsMap['distributor_type'] || []}
              distributorDivisionOptions={optionsMap['distributor_division'] || []}
              selectedTypes={filters['distributor_type'] || []}
              selectedDivisions={filters['distributor_division'] || []}
              onTypeChange={values => handleMultiFilterChange('distributor_type', values)}
              onDivisionChange={values => handleMultiFilterChange('distributor_division', values)}
              distributorSource={distributorSource}
              onDistributorSourceChange={handleDistributorSourceChange}
              geoEnabled={geoEnabled}
              geoDisabled={!isGeoActive}
              geoChildren={
                <GeographicalHierarchyFilter
                  selectedReport={reportConfig}
                  filters={filters}
                  optionsMap={optionsMap}
                  loadingMap={loadingMap}
                  onLevelChange={handleGeoLevelChange}
                  onValueChange={handleGeoValueChange}
                  onLoadLevels={loadGeographicalLevels}
                  onNextLevel={handleGeoNextLevel}
                  onResetAll={handleGeoResetAll}
                />
              }
              isHierarchySyncing={isHierarchySyncing}
              salesEnabled={salesEnabled}
              salesDisabled={!isSalesActive}
              salesChildren={
                <SalesHierarchyFilter
                  selectedReport={reportConfig}
                  filters={filters}
                  optionsMap={optionsMap}
                  loadingMap={loadingMap}
                  onLevelChange={handleSalesLevelChange}
                  onValueChange={handleSalesValueChange}
                  onLoadLevels={loadSalesLevels}
                  onNextLevel={handleSalesNextLevel}
                  onResetAll={handleSalesResetAll}
                />
              }
              distributorOptions={distributorFieldKey ? (optionsMap[distributorFieldKey] || []) : []}
              selectedDistributors={distributorFieldKey ? (filters[distributorFieldKey] || []) : []}
              onDistributorChange={values => distributorFieldKey && handleMultiFilterChange(distributorFieldKey, values)}
              distributorLoading={distributorFieldKey ? (loadingMap[distributorFieldKey] || false) : false}
              onDistributorOpen={() => distributorFieldKey && loadDistributorOptions(distributorFieldKey)}
              showDistributorFilter={!!distConfig?.enabled && !isDistributorView}
              onGeoDropdownClose={handleGeoDropdownClose}
              onSalesDropdownClose={handleSalesDropdownClose}
              onReset={handleReset}
            />
          )}
        </div>
        <div className="sc-filter-actions">
          {!noPreview && (
            <button className="sc-btn-preview" onClick={() => setShowPreview(true)} disabled={isPreviewDisabled}>Preview</button>
          )}
          <div className="sc-download-wrap" ref={downloadMenuRef}>
            <button className="sc-btn-download" onClick={() => !downloading && setDownloadMenuOpen(v => !v)} disabled={downloading || isDownloadDisabled}>
              {downloading ? (<><span className="sc-download-spinner" />Downloading...</>) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</>
              )}
            </button>
            {downloadMenuOpen && !downloading && (
              <div className="sc-download-menu">
                {reportConfig.isPDFReport ? (
                  <div className="sc-download-menu-item" onClick={() => handleDownload('pdf')}>PDF</div>
                ) : reportConfig.isGSTRReport || reportConfig.customDownload ? (
                  <div className="sc-download-menu-item" onClick={() => handleDownload('xlsx')}>XLS</div>
                ) : (<>
                  <div className="sc-download-menu-item" onClick={() => handleDownload('csv')}>CSV</div>
                  <div className="sc-download-menu-item" onClick={() => handleDownload('xlsx')}>XLS</div>
                </>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Filter chips ── */}
      {chips.length > 0 && (
        <div className="sc-filter-chips">
          {chips.map(chip => (
            <span key={chip.key} className="sc-chip">
              <span className="sc-chip-key">{chip.label}: </span>
              <strong>{chip.value || '--'}</strong>
              {chip.count !== undefined && chip.count > 0 && ` +${chip.count}`}
              <span className="sc-chip-remove" onClick={chip.onRemove}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Row 4: Preview ── */}
      <div className="sc-report-content">
        <MdmReportsPreview
          reportConfig={reportConfig}
          filters={filters}
          fromDate={fromDate}
          toDate={toDate}
          salesDrillDownPath={salesDrillDownPath}
          geoDrillDownPath={geoDrillDownPath}
          primaryFilter={null}
          customFilters={customFilters}
          showPreview={showPreview && !noPreview}
          noPreviewText={noPreviewText}
          isNoPreviewReport={noPreview}
          optionsMap={optionsMap}
          loadingMap={loadingMap}
          onFilterChange={handleMultiFilterChange}
          onFilterOpen={handleFilterOpen}
          customFiltersLoading={customFiltersLoading}
        />
      </div>
    </div>
  );
}
