import { describe, it, expect } from 'vitest';
import {
  summarizeDrillDownPath,
  transformApiResponseToFilterOptions,
} from '../src/utils/hierarchyHelpers';
import type { DrillDownPathItem } from '../src/services/types';

describe('summarizeDrillDownPath', () => {
  it('returns an empty array for an empty path', () => {
    expect(summarizeDrillDownPath([])).toEqual([]);
  });

  it('groups consecutive items at the same level with a count', () => {
    const path: DrillDownPathItem[] = [
      { level: 'rsm', value: 'r1' },
      { level: 'rsm', value: 'r2' },
      { level: 'rsm', value: 'r3' },
    ];
    expect(summarizeDrillDownPath(path)).toEqual([
      { level: 'rsm', count: 3, startIndex: 0, firstValue: 'r1' },
    ]);
  });

  it('produces one summary entry per contiguous level block', () => {
    const path: DrillDownPathItem[] = [
      { level: 'nsm', value: 'n1' },
      { level: 'rsm', value: 'r1' },
      { level: 'rsm', value: 'r2' },
      { level: 'ase', value: 'a1' },
    ];
    expect(summarizeDrillDownPath(path)).toEqual([
      { level: 'nsm', count: 1, startIndex: 0, firstValue: 'n1' },
      { level: 'rsm', count: 2, startIndex: 1, firstValue: 'r1' },
      { level: 'ase', count: 1, startIndex: 3, firstValue: 'a1' },
    ]);
  });

  it('does not merge same-level blocks that are not contiguous', () => {
    const path: DrillDownPathItem[] = [
      { level: 'rsm', value: 'r1' },
      { level: 'ase', value: 'a1' },
      { level: 'rsm', value: 'r2' },
    ];
    const summary = summarizeDrillDownPath(path);
    expect(summary).toHaveLength(3);
    expect(summary.map((s) => s.level)).toEqual(['rsm', 'ase', 'rsm']);
  });
});

describe('transformApiResponseToFilterOptions', () => {
  it('returns an empty array for a non-array input', () => {
    expect(transformApiResponseToFilterOptions(null)).toEqual([]);
    expect(transformApiResponseToFilterOptions({})).toEqual([]);
    expect(transformApiResponseToFilterOptions('x')).toEqual([]);
  });

  it('maps default value/label keys', () => {
    const out = transformApiResponseToFilterOptions([
      { value: '1', label: 'One' },
      { value: '2', label: 'Two' },
    ]);
    expect(out).toEqual([
      { value: '1', label: 'One' },
      { value: '2', label: 'Two' },
    ]);
  });

  it('honors custom value/label keys', () => {
    const out = transformApiResponseToFilterOptions(
      [{ id: 'a', name: 'Alpha' }],
      'id',
      'name',
    );
    expect(out).toEqual([{ value: 'a', label: 'Alpha' }]);
  });

  it('yields undefined fields when keys are missing', () => {
    const out = transformApiResponseToFilterOptions([{ foo: 'bar' }]);
    expect(out).toEqual([{ value: undefined, label: undefined }]);
  });
});
