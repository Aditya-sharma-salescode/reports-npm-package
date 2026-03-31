import type { newReportConfig } from './mdmReportsUtils';

export type ReportItem = {
  id: string;
  name: string;
  /** Group label, e.g. "Sales", "Master", "Tax" */
  type: string;
  filter?: string;
  isNewUi?: boolean;
  isNewReportUi?: boolean;
  newReportConfig?: newReportConfig;
};

export type ReportGroup = {
  type: string;
  name: string;
  children: ReportItem[];
};
