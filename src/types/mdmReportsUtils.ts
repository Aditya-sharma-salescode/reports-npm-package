// ─── Core config type — one entry per report card ─────────────────────────────

export interface newReportConfig {
  reportDesignation?: string;
  filterReportName?: string;
  id: string;
  name: string;
  type?: string;
  getAPI: string;
  reportName: string;
  description: string;
  templateUrl: string;
  filterConfiguration?: ReportTableConfiguration;
  salesHierarchyFilter?: SalesHierarchyFilter;
  geographicalHierarchyFilter?: GeographicalHierarchyFilter;
  distributorFilter?: DistributorFilterConfig;
  mandatory?: boolean;
  dateRangeFilter?: boolean;
  newDateFormat?: boolean;
  periodFilter?: boolean;
  isDistributorView: boolean;
  showDistributorType?: boolean;
  showDistributorDivision?: boolean;
  shouldShowCustomFilters?: boolean;
  columnsToHide?: string[];
  filtersToHide?: string[];
  isLiveReport?: boolean;
  mergedFilters?: Record<string, MergedFilterSource[]>;
  showLast7DaysFilter?: boolean;
  showLast3MonthsFilter?: boolean;
  shouldShowCustomDateFilter?: boolean;
  isPDFReport?: boolean;
  /** e.g. "1 week" | "4 days" | "5 months" | "1 year" */
  dateRangeAllowed?: string;
  isGSTRReport?: boolean;
  gstrYearsRange?: number;
  customDownload?: boolean;
  customDateRangeAllowed?: string;
  showAdditionalFilters?: boolean;
  sendMetadata?: boolean;
  metadataFields?: string[];
  disableValidation?: boolean;
  fullAllow?: boolean;
}

// ─── Filter & column configuration ────────────────────────────────────────────

export interface ReportColumnConfig {
  columnName: string;
  id: string;
  label: string;
  mandatory: boolean;
  showInTable: boolean;
  tableField: string;
}

export interface ReportTableConfiguration {
  columns: ReportColumnConfig[];
}

// ─── Hierarchy filter configs ──────────────────────────────────────────────────

export interface SalesHierarchyFilter {
  enabled: boolean;
  levelFilterLabel: string;
  levelFilterField: string;
  valueFilterLabel: string;
  valueFilterField: string;
  /** e.g. ["saleshead", "nsm", "asm", "rsm", "ase", "sde", "supplier"] */
  hierarchyOrder?: string[];
  hierarchyMap?: Record<string, string[]>;
  rootLevels?: string[];
}

export interface GeographicalHierarchyFilter {
  enabled: boolean;
  levelFilterLabel: string;
  levelFilterField: string;
  valueFilterLabel: string;
  valueFilterField: string;
  /** e.g. ["country", "region", "state", "district", "city"] */
  hierarchyOrder?: string[];
  hierarchyMap?: Record<string, string[]>;
  rootLevels?: string[];
}

export interface DistributorFilterConfig {
  enabled: boolean;
  label: string;
  /** API field name, e.g. "distributor" */
  field: string;
}

// ─── Merged filters ────────────────────────────────────────────────────────────

export interface MergedFilterSource {
  /** Source filter alias (e.g., "field1") */
  alias: string;
  /** Option value (e.g., "612") */
  value: string;
}

// ─── Custom filter config ──────────────────────────────────────────────────────

export interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'autocomplete' | 'multiselect';
  options?: { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
  dependency?: string;
}

// ─── Date range ────────────────────────────────────────────────────────────────

export interface DateRangeOption {
  id: string;
  label: string;
  fromDate: string;
  toDate: string;
}

// ─── Full report config (composed) ────────────────────────────────────────────

export interface MdmReportsConfig {
  dateRangeOptions: DateRangeOption[];
  geographicalFilters: FilterConfig[];
  distributorFilter: FilterConfig;
  salesHierarchyFilters: FilterConfig[];
  filterConfiguration: ReportColumnConfig[];
}

// ─── Date range allowed ────────────────────────────────────────────────────────

export type DateRangeAllowedUnit =
  | 'day'
  | 'days'
  | 'week'
  | 'weeks'
  | 'month'
  | 'months'
  | 'year'
  | 'years';

export type DateRangeAllowed = `${number} ${DateRangeAllowedUnit}`;

// ─── Date range utility functions ──────────────────────────────────────────────

type NormalizedUnit = 'day' | 'week' | 'month' | 'year';

function normalizeUnit(unit: string): NormalizedUnit | null {
  const u = unit.toLowerCase();
  if (u === 'day' || u === 'days') return 'day';
  if (u === 'week' || u === 'weeks') return 'week';
  if (u === 'month' || u === 'months') return 'month';
  if (u === 'year' || u === 'years') return 'year';
  return null;
}

export function parseDateRangeAllowed(
  input: string
): { amount: number; unit: NormalizedUnit } | null {
  const parts = input.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const amount = parseInt(parts[0], 10);
  const unit = normalizeUnit(parts[1]);
  if (isNaN(amount) || !unit) return null;
  return { amount, unit };
}

export function getDateRangeFromAllowed(
  allowed: string,
  now: Date = new Date()
): { start: Date; end: Date } | null {
  const parsed = parseDateRangeAllowed(allowed);
  if (!parsed) return null;

  const end = new Date(now);
  const start = new Date(now);

  switch (parsed.unit) {
    case 'day':
      start.setDate(start.getDate() - parsed.amount);
      break;
    case 'week':
      start.setDate(start.getDate() - parsed.amount * 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - parsed.amount);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - parsed.amount);
      break;
  }

  return { start, end };
}

export function getLabelFromAllowed(allowed: string): string {
  const parsed = parseDateRangeAllowed(allowed);
  if (!parsed) return allowed;
  const unitLabel =
    parsed.unit === 'day'
      ? parsed.amount === 1 ? 'Day' : 'Days'
      : parsed.unit === 'week'
      ? parsed.amount === 1 ? 'Week' : 'Weeks'
      : parsed.unit === 'month'
      ? parsed.amount === 1 ? 'Month' : 'Months'
      : parsed.amount === 1 ? 'Year' : 'Years';
  return `Last ${parsed.amount} ${unitLabel}`;
}

export function getMaxDateFromCustomRange(
  allowed: string,
  startDate: Date
): Date | null {
  const parsed = parseDateRangeAllowed(allowed);
  if (!parsed) return null;

  const max = new Date(startDate);
  switch (parsed.unit) {
    case 'day':
      max.setDate(max.getDate() + parsed.amount - 1);
      break;
    case 'week':
      max.setDate(max.getDate() + parsed.amount * 7 - 1);
      break;
    case 'month':
      max.setMonth(max.getMonth() + parsed.amount);
      max.setDate(max.getDate() - 1);
      break;
    case 'year':
      max.setFullYear(max.getFullYear() + parsed.amount);
      max.setDate(max.getDate() - 1);
      break;
  }
  return max;
}
