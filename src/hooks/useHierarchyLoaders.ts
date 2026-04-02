import { useCallback, Dispatch, SetStateAction } from 'react';
import {
  fetchSalesDesignations,
  fetchUsersByDesignation,
  fetchChildrenUsers,
  fetchGeographicalLevels,
  fetchGeographicalLocations,
  fetchGeographicalLocationsUnder,
} from '../services/reportsDataService';
import type { newReportConfig } from '../types/mdmReportsUtils';
import type { DrillDownPathItem } from '../services/types';

interface UseHierarchyLoadersParams {
  selectedReport: newReportConfig | null;
  filters: Record<string, string[]>;
  setOptionsMap: Dispatch<SetStateAction<Record<string, { label: string; value: string }[]>>>;
  setLoadingMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  salesDrillDownPath: DrillDownPathItem[];
  geoDrillDownPath: DrillDownPathItem[];
  geoHierarchyOrder: string[];
  setGeoHierarchyOrder: Dispatch<SetStateAction<string[]>>;
  salesOptionsCache: Record<string, { label: string; value: string }[]>;
  setSalesOptionsCache: Dispatch<SetStateAction<Record<string, { label: string; value: string }[]>>>;
  geoOptionsCache: Record<string, { label: string; value: string }[]>;
  setGeoOptionsCache: Dispatch<SetStateAction<Record<string, { label: string; value: string }[]>>>;
}

export function useHierarchyLoaders({
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
}: UseHierarchyLoadersParams) {

  // ── Sales: load level list ─────────────────────────────────────────────────
  const loadSalesLevels = useCallback(async () => {
    if (!selectedReport?.salesHierarchyFilter?.enabled) return;

    const key = selectedReport.salesHierarchyFilter.levelFilterField;
    setLoadingMap(prev => ({ ...prev, [key]: true }));
    try {
      let availableLevels: string[] = [];
      const hierarchyOrder = selectedReport.salesHierarchyFilter.hierarchyOrder || [];

      if (hierarchyOrder.length > 0) {
        availableLevels = hierarchyOrder.filter(level => level !== 'supplier');
      } else {
        const fallbackLevels = await fetchSalesDesignations('admin', 'all');
        availableLevels = fallbackLevels.filter(level => level !== 'supplier');
      }

      const opts = availableLevels.map(level => ({ label: level, value: level }));
      setOptionsMap(prev => ({ ...prev, [key]: opts }));
    } catch {
      setOptionsMap(prev => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  }, [selectedReport?.salesHierarchyFilter, setLoadingMap, setOptionsMap]);

  // ── Sales: load values for a designation ──────────────────────────────────
  const loadSalesValues = useCallback(async (designation: string) => {
    if (!selectedReport?.salesHierarchyFilter?.enabled) return;

    const hierarchyOrder = selectedReport.salesHierarchyFilter.hierarchyOrder || [];
    const targetLevelIndex = hierarchyOrder.indexOf(designation);

    // Check cache validity
    const cachedOptions = salesOptionsCache[designation];
    let hasValidParentContext = false;
    if (targetLevelIndex === 0) {
      hasValidParentContext = true;
    } else if (targetLevelIndex > 0) {
      // Check drillDownPath
      for (let i = salesDrillDownPath.length - 1; i >= 0; i--) {
        const pathItem = salesDrillDownPath[i];
        const pathLevelIndex = hierarchyOrder.indexOf(pathItem.level);
        if (pathLevelIndex !== -1 && pathLevelIndex < targetLevelIndex) {
          hasValidParentContext = true;
          break;
        }
      }
      // Check filters
      if (!hasValidParentContext) {
        for (let i = 0; i < targetLevelIndex; i++) {
          if (filters[hierarchyOrder[i]]?.length > 0) {
            hasValidParentContext = true;
            break;
          }
        }
      }
    } else {
      hasValidParentContext = true;
    }

    if (cachedOptions?.length > 0 && hasValidParentContext) {
      setOptionsMap(prev => ({ ...prev, [designation]: cachedOptions }));
      return;
    }

    setLoadingMap(prev => ({ ...prev, [designation]: true }));
    try {
      let users: string[] = [];

      // Find closest parent with values
      let parentUsers: string[] = [];
      if (targetLevelIndex > 0) {
        for (let i = targetLevelIndex - 1; i >= 0; i--) {
          const parentLevel = hierarchyOrder[i];
          const parentValues = filters[parentLevel] || [];
          if (parentValues.length > 0) {
            parentUsers = parentValues;
            break;
          }
        }
      }

      // Check drillDownPath
      if (parentUsers.length === 0 && salesDrillDownPath.length > 0) {
        for (let i = salesDrillDownPath.length - 1; i >= 0; i--) {
          const pathItem = salesDrillDownPath[i];
          const pathLevelIndex = hierarchyOrder.indexOf(pathItem.level);
          if (pathLevelIndex !== -1 && pathLevelIndex < targetLevelIndex) {
            parentUsers = salesDrillDownPath
              .filter(item => item.level === pathItem.level)
              .map(item => item.value);
            break;
          }
        }
      }

      if (parentUsers.length > 0) {
        const allChildrenResults = await Promise.all(
          parentUsers.map(userId => fetchChildrenUsers(userId, designation))
        );
        users = Array.from(new Set(allChildrenResults.flat()));
      } else {
        users = await fetchUsersByDesignation(designation);
      }

      const opts = users.map(user => ({ label: String(user), value: String(user) }));
      setOptionsMap(prev => ({ ...prev, [designation]: opts }));
      setSalesOptionsCache(prev => ({ ...prev, [designation]: opts }));
    } catch {
      setOptionsMap(prev => ({ ...prev, [designation]: [] }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [designation]: false }));
    }
  }, [
    selectedReport?.salesHierarchyFilter,
    salesDrillDownPath,
    filters,
    setLoadingMap,
    setOptionsMap,
    salesOptionsCache,
    setSalesOptionsCache,
  ]);

  // ── Geo: load level list ──────────────────────────────────────────────────
  const loadGeographicalLevels = useCallback(async () => {
    if (!selectedReport?.geographicalHierarchyFilter?.enabled) return;

    const levelKey = selectedReport.geographicalHierarchyFilter.levelFilterField;
    setLoadingMap(prev => ({ ...prev, [levelKey]: true }));
    try {
      const levelsFromApi = await fetchGeographicalLevels();
      const allLevels = [...levelsFromApi].reverse();
      setGeoHierarchyOrder(allLevels);

      const opts = allLevels.map(level => ({ label: level, value: level }));
      setOptionsMap(prev => ({ ...prev, [levelKey]: opts }));
    } catch {
      setOptionsMap(prev => ({ ...prev, [levelKey]: [] }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [levelKey]: false }));
    }
  }, [selectedReport?.geographicalHierarchyFilter, setGeoHierarchyOrder, setLoadingMap, setOptionsMap]);

  // ── Geo: load values for a level ──────────────────────────────────────────
  const loadGeographicalValues = useCallback(async (level: string) => {
    if (!selectedReport?.geographicalHierarchyFilter?.enabled) return;

    setLoadingMap(prev => ({ ...prev, [level]: true }));
    try {
      let hierarchyOrder = geoHierarchyOrder;
      if (hierarchyOrder.length === 0) {
        const levelsFromApi = await fetchGeographicalLevels();
        hierarchyOrder = [...levelsFromApi].reverse();
        setGeoHierarchyOrder(hierarchyOrder);
      }

      const targetLevelIndex = hierarchyOrder.indexOf(level);

      // Check cache
      const cachedOptions = geoOptionsCache[level];
      let hasValidParentContext = targetLevelIndex === 0;
      if (!hasValidParentContext && targetLevelIndex > 0) {
        for (let i = geoDrillDownPath.length - 1; i >= 0; i--) {
          const pathItem = geoDrillDownPath[i];
          const pathLevelIndex = hierarchyOrder.indexOf(pathItem.level);
          if (pathLevelIndex !== -1 && pathLevelIndex < targetLevelIndex) {
            hasValidParentContext = true;
            break;
          }
        }
        if (!hasValidParentContext) {
          for (let i = 0; i < targetLevelIndex; i++) {
            if (filters[hierarchyOrder[i]]?.length > 0) {
              hasValidParentContext = true;
              break;
            }
          }
        }
      }

      if (cachedOptions?.length > 0 && hasValidParentContext) {
        setOptionsMap(prev => ({ ...prev, [level]: cachedOptions }));
        setLoadingMap(prev => ({ ...prev, [level]: false }));
        return;
      }

      // Find parent locations
      let parentLocations: { level: string; value: string }[] = [];
      if (targetLevelIndex > 0) {
        for (let i = targetLevelIndex - 1; i >= 0; i--) {
          const parentLevel = hierarchyOrder[i];
          const parentValues = filters[parentLevel] || [];
          if (parentValues.length > 0) {
            parentLocations = parentValues.map(v => ({ level: parentLevel, value: v }));
            break;
          }
        }
      }
      if (parentLocations.length === 0 && geoDrillDownPath.length > 0) {
        for (let i = geoDrillDownPath.length - 1; i >= 0; i--) {
          const pathItem = geoDrillDownPath[i];
          const pathLevelIndex = hierarchyOrder.indexOf(pathItem.level);
          if (pathLevelIndex !== -1 && pathLevelIndex < targetLevelIndex) {
            parentLocations = geoDrillDownPath
              .filter(item => item.level === pathItem.level)
              .map(item => ({ level: item.level, value: item.value }));
            break;
          }
        }
      }

      let locations: string[];
      if (parentLocations.length > 0) {
        const parentLevel = parentLocations[0].level;
        const allResults = await Promise.all(
          parentLocations.map(loc =>
            fetchGeographicalLocationsUnder(parentLevel, loc.value, level)
          )
        );
        locations = Array.from(new Set(allResults.flat()));
      } else {
        locations = await fetchGeographicalLocations(level);
      }

      const opts = locations.map(loc => ({ label: String(loc), value: String(loc) }));
      setOptionsMap(prev => ({ ...prev, [level]: opts }));
      setGeoOptionsCache(prev => ({ ...prev, [level]: opts }));
    } catch {
      setOptionsMap(prev => ({ ...prev, [level]: [] }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [level]: false }));
    }
  }, [
    selectedReport?.geographicalHierarchyFilter,
    geoDrillDownPath,
    geoHierarchyOrder,
    filters,
    setLoadingMap,
    setOptionsMap,
    setGeoHierarchyOrder,
    geoOptionsCache,
    setGeoOptionsCache,
  ]);

  return {
    loadSalesLevels,
    loadSalesValues,
    loadGeographicalLevels,
    loadGeographicalValues,
  };
}
