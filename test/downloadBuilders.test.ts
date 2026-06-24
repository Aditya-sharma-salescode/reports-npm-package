import { describe, it, expect } from 'vitest';
import {
  buildLocationFilters,
  buildUserFilters,
} from '../src/services/mdmReportsDownloadService';
import type { DrillDownPathItem } from '../src/services/types';

describe('buildLocationFilters', () => {
  it('returns an empty array for an empty path', () => {
    expect(buildLocationFilters([])).toEqual([]);
  });

  it('maps each level to its value', () => {
    const path: DrillDownPathItem[] = [
      { level: 'state', value: 'MH' },
      { level: 'city', value: 'Mumbai' },
    ];
    expect(buildLocationFilters(path)).toEqual([
      { level: 'state', value: 'MH' },
      { level: 'city', value: 'Mumbai' },
    ]);
  });

  it('dedupes by level, keeping the last value seen', () => {
    const path: DrillDownPathItem[] = [
      { level: 'state', value: 'MH' },
      { level: 'state', value: 'KA' },
    ];
    expect(buildLocationFilters(path)).toEqual([{ level: 'state', value: 'KA' }]);
  });
});

describe('buildUserFilters', () => {
  const order = ['nsm', 'rsm', 'ase', 'supplier'];

  it('returns an empty array for an empty path', () => {
    expect(buildUserFilters([], order)).toEqual([]);
  });

  it('marks the supplier (last) level as direct and others as not direct', () => {
    const path: DrillDownPathItem[] = [
      { level: 'rsm', value: 'r1' },
      { level: 'supplier', value: 's1' },
    ];
    expect(buildUserFilters(path, order)).toEqual([
      { userId: 'r1', direct: false },
      { userId: 's1', direct: true },
    ]);
  });

  it('treats no items at the supplier level as all indirect', () => {
    const path: DrillDownPathItem[] = [{ level: 'nsm', value: 'n1' }];
    expect(buildUserFilters(path, order)).toEqual([{ userId: 'n1', direct: false }]);
  });

  it('uses the value as the userId', () => {
    const path: DrillDownPathItem[] = [{ level: 'supplier', value: 'login-99' }];
    expect(buildUserFilters(path, order)).toEqual([{ userId: 'login-99', direct: true }]);
  });
});
