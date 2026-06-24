import { describe, it, expect } from 'vitest';
import {
  filterDistributorsBySelections,
  fetchDistributorMeta,
} from '../src/services/distributorMetaService';
import { makeDistributor } from './fixtures';

const features = [
  makeDistributor({ loginId: 'L1', prodauthcode: 'DIV_A,DIV_B', extendedAttributes: { distType: 'Wholesaler' } }),
  makeDistributor({ loginId: 'L2', prodauthcode: 'DIV_B', extendedAttributes: { distType: 'Retailer' } }),
  makeDistributor({ loginId: 'L3', prodauthcode: 'DIV_C', extendedAttributes: { distType: 'Wholesaler' } }),
  makeDistributor({ loginId: 'L4', prodauthcode: undefined, extendedAttributes: {} }),
];

describe('filterDistributorsBySelections', () => {
  it('returns every loginId when no filters are applied', () => {
    expect(filterDistributorsBySelections(features, [], [])).toEqual(['L1', 'L2', 'L3', 'L4']);
  });

  it('filters by distributor type', () => {
    expect(filterDistributorsBySelections(features, ['Wholesaler'], [])).toEqual(['L1', 'L3']);
  });

  it('filters by division (prodauthcode contains the division)', () => {
    expect(filterDistributorsBySelections(features, [], ['DIV_B'])).toEqual(['L1', 'L2']);
  });

  it('excludes features with no prodauthcode when a division is selected', () => {
    const out = filterDistributorsBySelections(features, [], ['DIV_C']);
    expect(out).toEqual(['L3']);
    expect(out).not.toContain('L4');
  });

  it('applies type and division filters together (AND)', () => {
    expect(filterDistributorsBySelections(features, ['Wholesaler'], ['DIV_A'])).toEqual(['L1']);
  });

  it('matches any of multiple selected divisions (OR within divisions)', () => {
    expect(filterDistributorsBySelections(features, [], ['DIV_A', 'DIV_C'])).toEqual(['L1', 'L3']);
  });

  it('intersects the result with allowedLoginIds when provided', () => {
    expect(filterDistributorsBySelections(features, ['Wholesaler'], [], ['L3'])).toEqual(['L3']);
  });

  it('returns an empty array when allowedLoginIds excludes everything', () => {
    expect(filterDistributorsBySelections(features, [], [], ['L99'])).toEqual([]);
  });

  it('ignores an empty allowedLoginIds list (no narrowing)', () => {
    expect(filterDistributorsBySelections(features, ['Retailer'], [], [])).toEqual(['L2']);
  });
});

describe('fetchDistributorMeta', () => {
  it('resolves to empty meta (host call is currently disabled)', async () => {
    await expect(fetchDistributorMeta()).resolves.toEqual({
      features: [],
      divisions: [],
      types: [],
    });
  });
});
