import { describe, it, expect } from 'vitest';
import {
  parseDateRangeAllowed,
  getDateRangeFromAllowed,
  getLabelFromAllowed,
  getMaxDateFromCustomRange,
} from '../src/types/mdmReportsUtils';

describe('parseDateRangeAllowed', () => {
  it('parses a singular day', () => {
    expect(parseDateRangeAllowed('1 day')).toEqual({ amount: 1, unit: 'day' });
  });

  it('parses plural units and normalizes to singular', () => {
    expect(parseDateRangeAllowed('4 days')).toEqual({ amount: 4, unit: 'day' });
    expect(parseDateRangeAllowed('2 weeks')).toEqual({ amount: 2, unit: 'week' });
    expect(parseDateRangeAllowed('3 months')).toEqual({ amount: 3, unit: 'month' });
    expect(parseDateRangeAllowed('5 years')).toEqual({ amount: 5, unit: 'year' });
  });

  it('is case-insensitive on the unit', () => {
    expect(parseDateRangeAllowed('1 WEEK')).toEqual({ amount: 1, unit: 'week' });
  });

  it('tolerates extra whitespace', () => {
    expect(parseDateRangeAllowed('  2   months  ')).toEqual({ amount: 2, unit: 'month' });
  });

  it('returns null for an unknown unit', () => {
    expect(parseDateRangeAllowed('3 fortnights')).toBeNull();
  });

  it('returns null when the amount is not a number', () => {
    expect(parseDateRangeAllowed('many days')).toBeNull();
  });

  it('returns null for the wrong number of parts', () => {
    expect(parseDateRangeAllowed('week')).toBeNull();
    expect(parseDateRangeAllowed('1 2 weeks')).toBeNull();
    expect(parseDateRangeAllowed('')).toBeNull();
  });
});

describe('getDateRangeFromAllowed', () => {
  const now = new Date('2024-06-17T12:00:00.000Z');

  it('returns end === the reference date', () => {
    const r = getDateRangeFromAllowed('1 week', now)!;
    expect(r.end.getTime()).toBe(now.getTime());
  });

  it('subtracts days', () => {
    const r = getDateRangeFromAllowed('5 days', now)!;
    expect(r.start.getDate()).toBe(12); // 17 - 5
  });

  it('subtracts weeks as 7-day multiples', () => {
    const r = getDateRangeFromAllowed('2 weeks', now)!;
    // 17 June - 14 days = 3 June
    expect(r.start.getMonth()).toBe(5); // June
    expect(r.start.getDate()).toBe(3);
  });

  it('subtracts months', () => {
    const r = getDateRangeFromAllowed('3 months', now)!;
    expect(r.start.getMonth()).toBe(2); // March (June - 3)
  });

  it('subtracts years', () => {
    const r = getDateRangeFromAllowed('1 year', now)!;
    expect(r.start.getFullYear()).toBe(2023);
  });

  it('does not mutate the passed-in now', () => {
    const ref = new Date('2024-06-17T12:00:00.000Z');
    getDateRangeFromAllowed('1 month', ref);
    expect(ref.getTime()).toBe(new Date('2024-06-17T12:00:00.000Z').getTime());
  });

  it('returns null for an invalid allowed string', () => {
    expect(getDateRangeFromAllowed('nonsense', now)).toBeNull();
  });
});

describe('getLabelFromAllowed', () => {
  it('builds singular labels', () => {
    expect(getLabelFromAllowed('1 day')).toBe('Last 1 Day');
    expect(getLabelFromAllowed('1 week')).toBe('Last 1 Week');
    expect(getLabelFromAllowed('1 month')).toBe('Last 1 Month');
    expect(getLabelFromAllowed('1 year')).toBe('Last 1 Year');
  });

  it('builds plural labels', () => {
    expect(getLabelFromAllowed('4 days')).toBe('Last 4 Days');
    expect(getLabelFromAllowed('2 weeks')).toBe('Last 2 Weeks');
    expect(getLabelFromAllowed('3 months')).toBe('Last 3 Months');
    expect(getLabelFromAllowed('5 years')).toBe('Last 5 Years');
  });

  it('returns the original string when it cannot be parsed', () => {
    expect(getLabelFromAllowed('garbage')).toBe('garbage');
  });
});

describe('getMaxDateFromCustomRange', () => {
  const start = new Date('2024-01-01T00:00:00.000Z');

  it('computes the inclusive max for days (start + n - 1)', () => {
    const max = getMaxDateFromCustomRange('7 days', new Date(start))!;
    expect(max.getDate()).toBe(7); // Jan 1 + 7 - 1 = Jan 7
  });

  it('computes the inclusive max for weeks', () => {
    const max = getMaxDateFromCustomRange('1 week', new Date(start))!;
    expect(max.getDate()).toBe(7); // 1 + 7 - 1
  });

  it('computes the max for months (next month minus a day)', () => {
    const max = getMaxDateFromCustomRange('1 month', new Date(start))!;
    // Jan 1 + 1 month = Feb 1, minus 1 day = Jan 31
    expect(max.getMonth()).toBe(0); // January
    expect(max.getDate()).toBe(31);
  });

  it('computes the max for years', () => {
    const max = getMaxDateFromCustomRange('1 year', new Date(start))!;
    // Jan 1 2024 + 1 year - 1 day = Dec 31 2024
    expect(max.getFullYear()).toBe(2024);
    expect(max.getMonth()).toBe(11);
    expect(max.getDate()).toBe(31);
  });

  it('does not mutate the start date', () => {
    const s = new Date('2024-01-01T00:00:00.000Z');
    getMaxDateFromCustomRange('3 months', s);
    expect(s.getTime()).toBe(new Date('2024-01-01T00:00:00.000Z').getTime());
  });

  it('returns null for an invalid allowed string', () => {
    expect(getMaxDateFromCustomRange('bad', new Date(start))).toBeNull();
  });
});
