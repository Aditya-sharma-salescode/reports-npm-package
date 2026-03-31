import type { newReportConfig } from '../types/mdmReportsUtils';
import type { Dayjs } from 'dayjs';

export interface ReportFilterParams {
  report: string;
  which: string;
  contains?: string;
  page?: number;
  pageSize?: number;
  isDistributorview?: boolean;
  filters?: Record<string, string[]>;
  additionalFilters?: Record<string, string[]>;
  since?: string;
  until?: string;
  distributorFilter?: {
    locationFilters?: { level: string; value: string }[];
    userFilters?: { userId: string; direct: boolean }[];
  };
}

export interface ReportSearchResponse {
  items: Record<string, unknown>[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export interface FilterOption {
  alias: string;
  display: string;
}

export interface ColumnOption {
  alias: string;
  display: string;
}

export interface LiveReportDownloadRequest {
  configName: string;
  dateRange?: { startDate: string; endDate: string };
  period?: string;
  year?: string;
  filters?: { map?: Record<string, string[]>; pf?: string };
  distributorFilter?: {
    locationFilters?: { level: string; value: string }[];
    userFilters?: { userId: string; direct: boolean }[];
  };
  format: string;
}

export interface SnapshotReportDownloadRequest {
  reportName: string;
  filters?: { map?: Record<string, string[]>; pf?: string };
  dateRange?: { startDate: string; endDate: string };
  format?: string;
  distributorFilter?: {
    locationFilters?: { level: string; value: string }[];
    userFilters?: { userId: string; direct: boolean }[];
  };
}

export interface CustomReportDownloadRequest {
  attributes: {
    name: string;
    format: string;
    filters?: { map?: Record<string, string[]> };
    fromDate: string;
    toDate: string;
    metadata?: Record<string, string>;
  };
  lob: string;
}

export interface GSTRReportDownloadRequest {
  attributes: {
    name: string;
    format: string;
    loggedInUserName?: string;
    fromDate: string;
    toDate: string;
  };
  lob: string;
}

export interface PDFReportDownloadRequest {
  attributes: {
    name: string;
    format: string;
    loggedInUserName?: string;
    fromDate: string;
    toDate: string;
    filters: { map: Record<string, string[]> };
  };
  lob: string;
}

export interface DownloadParams {
  selectedReport: newReportConfig;
  filters: Record<string, string[]>;
  dateRangeType: 'daterange' | 'period';
  fromDate: Dayjs;
  toDate: Dayjs;
  period?: string;
  year?: string;
  format: string;
  primaryFilter: 'sales' | 'geographical' | 'distributor' | null;
  customFilters: string[];
  salesDrillDownPath?: DrillDownPathItem[];
  geoDrillDownPath?: DrillDownPathItem[];
  pf?: string;
  optionsMap?: Record<string, { label: string; value: string }[]>;
}

export interface DistributorFeature {
  id: string;
  loginId: string;
  prodauthcode?: string;
  extendedAttributes?: {
    distributorType?: string;
    distType?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DistributorMeta {
  types: string[];
  divisions: string[];
  features: DistributorFeature[];
}

export type DrillDownPathItem = { level: string; value: string };
export type PathSummaryItem = {
  level: string;
  count: number;
  startIndex: number;
  firstValue?: string;
};
