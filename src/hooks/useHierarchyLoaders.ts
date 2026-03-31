import { useState, useCallback } from 'react';
import {
  fetchSalesDesignations,
  fetchUsersByDesignation,
  fetchChildrenUsers,
  fetchGeographicalLevels,
  fetchGeographicalLocations,
  fetchGeographicalLocationsUnder,
} from '../services/reportsDataService';
import type { DrillDownPathItem } from '../services/types';

export interface HierarchyOption {
  label: string;
  value: string;
}

export interface UseHierarchyLoadersReturn {
  // Sales
  salesLevels: string[];
  salesOptions: Record<string, HierarchyOption[]>;
  salesLoadingMap: Record<string, boolean>;
  salesDrillDownPath: DrillDownPathItem[];
  loadSalesLevels: (parentDesignation?: string) => Promise<void>;
  loadSalesUsers: (designation: string) => Promise<void>;
  drillDownSales: (userId: string, designation: string) => Promise<void>;
  resetSales: () => void;

  // Geographical
  geoLevels: string[];
  geoOptions: Record<string, HierarchyOption[]>;
  geoLoadingMap: Record<string, boolean>;
  geoDrillDownPath: DrillDownPathItem[];
  loadGeoLevels: () => Promise<void>;
  loadGeoLocations: (level: string) => Promise<void>;
  drillDownGeo: (parentLevel: string, parentValue: string, childLevel: string) => Promise<void>;
  resetGeo: () => void;
}

export function useHierarchyLoaders(): UseHierarchyLoadersReturn {
  // ── Sales state ──────────────────────────────────────────────────────────────
  const [salesLevels, setSalesLevels] = useState<string[]>([]);
  const [salesOptions, setSalesOptions] = useState<Record<string, HierarchyOption[]>>({});
  const [salesLoadingMap, setSalesLoadingMap] = useState<Record<string, boolean>>({});
  const [salesDrillDownPath, setSalesDrillDownPath] = useState<DrillDownPathItem[]>([]);

  // ── Geo state ────────────────────────────────────────────────────────────────
  const [geoLevels, setGeoLevels] = useState<string[]>([]);
  const [geoOptions, setGeoOptions] = useState<Record<string, HierarchyOption[]>>({});
  const [geoLoadingMap, setGeoLoadingMap] = useState<Record<string, boolean>>({});
  const [geoDrillDownPath, setGeoDrillDownPath] = useState<DrillDownPathItem[]>([]);

  // ── Sales loaders ────────────────────────────────────────────────────────────

  const loadSalesLevels = useCallback(async (parentDesignation = 'root') => {
    setSalesLoadingMap((m) => ({ ...m, levels: true }));
    try {
      const levels = await fetchSalesDesignations(parentDesignation);
      setSalesLevels(levels);
    } finally {
      setSalesLoadingMap((m) => ({ ...m, levels: false }));
    }
  }, []);

  const loadSalesUsers = useCallback(async (designation: string) => {
    setSalesLoadingMap((m) => ({ ...m, [designation]: true }));
    try {
      const users = await fetchUsersByDesignation(designation);
      const options: HierarchyOption[] = users.map((u) => ({
        label: u.name || u.loginId,
        value: u.userId,
      }));
      setSalesOptions((prev) => ({ ...prev, [designation]: options }));
    } finally {
      setSalesLoadingMap((m) => ({ ...m, [designation]: false }));
    }
  }, []);

  const drillDownSales = useCallback(
    async (userId: string, nextDesignation: string) => {
      setSalesLoadingMap((m) => ({ ...m, [nextDesignation]: true }));
      try {
        const children = await fetchChildrenUsers(userId, nextDesignation);
        const options: HierarchyOption[] = children.map((u) => ({
          label: u.name || u.loginId,
          value: u.userId,
        }));
        setSalesOptions((prev) => ({ ...prev, [nextDesignation]: options }));
        setSalesDrillDownPath((prev) => [
          ...prev,
          { level: nextDesignation, value: userId },
        ]);
      } finally {
        setSalesLoadingMap((m) => ({ ...m, [nextDesignation]: false }));
      }
    },
    []
  );

  const resetSales = useCallback(() => {
    setSalesOptions({});
    setSalesDrillDownPath([]);
  }, []);

  // ── Geo loaders ──────────────────────────────────────────────────────────────

  const loadGeoLevels = useCallback(async () => {
    setGeoLoadingMap((m) => ({ ...m, levels: true }));
    try {
      const levels = await fetchGeographicalLevels();
      setGeoLevels(levels);
    } finally {
      setGeoLoadingMap((m) => ({ ...m, levels: false }));
    }
  }, []);

  const loadGeoLocations = useCallback(async (level: string) => {
    setGeoLoadingMap((m) => ({ ...m, [level]: true }));
    try {
      const locations = await fetchGeographicalLocations(level);
      const options: HierarchyOption[] = locations.map((l) => ({
        label: l.label || l.value,
        value: l.value,
      }));
      setGeoOptions((prev) => ({ ...prev, [level]: options }));
    } finally {
      setGeoLoadingMap((m) => ({ ...m, [level]: false }));
    }
  }, []);

  const drillDownGeo = useCallback(
    async (parentLevel: string, parentValue: string, childLevel: string) => {
      setGeoLoadingMap((m) => ({ ...m, [childLevel]: true }));
      try {
        const locations = await fetchGeographicalLocationsUnder(
          parentLevel,
          parentValue,
          childLevel
        );
        const options: HierarchyOption[] = locations.map((l) => ({
          label: l.label || l.value,
          value: l.value,
        }));
        setGeoOptions((prev) => ({ ...prev, [childLevel]: options }));
        setGeoDrillDownPath((prev) => [
          ...prev,
          { level: childLevel, value: parentValue },
        ]);
      } finally {
        setGeoLoadingMap((m) => ({ ...m, [childLevel]: false }));
      }
    },
    []
  );

  const resetGeo = useCallback(() => {
    setGeoOptions({});
    setGeoDrillDownPath([]);
  }, []);

  return {
    salesLevels,
    salesOptions,
    salesLoadingMap,
    salesDrillDownPath,
    loadSalesLevels,
    loadSalesUsers,
    drillDownSales,
    resetSales,
    geoLevels,
    geoOptions,
    geoLoadingMap,
    geoDrillDownPath,
    loadGeoLevels,
    loadGeoLocations,
    drillDownGeo,
    resetGeo,
  };
}
