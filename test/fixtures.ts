import type { newReportConfig } from '../src/types/mdmReportsUtils';
import type { DistributorFeature } from '../src/services/types';

/** Build a valid newReportConfig with sane defaults, overriding what you need. */
export function makeReportConfig(overrides: Partial<newReportConfig> = {}): newReportConfig {
  return {
    id: 'r1',
    name: 'Sales Report',
    getAPI: '',
    reportName: 'sales',
    description: 'A sales report',
    templateUrl: '',
    isDistributorView: false,
    ...overrides,
  };
}

/** Build a distributor feature for distributor-filter tests. */
export function makeDistributor(overrides: Partial<DistributorFeature> = {}): DistributorFeature {
  return {
    id: 'd1',
    loginId: 'L1',
    prodauthcode: 'DIV_A,DIV_B',
    extendedAttributes: { distType: 'Wholesaler' },
    ...overrides,
  };
}
