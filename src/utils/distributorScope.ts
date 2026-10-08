import { getAuthContext } from '../config/auth';

/** The filter key every distributor-scoped request is keyed on. */
export const DISTRIBUTOR_FILTER_KEY = 'distributor_code';

/** The parts of a report config that decide whether its data is scoped to one distributor. */
export interface DistributorScopeConfig {
  /** The report is shown to a distributor, who may only see their own rows. */
  isDistributorView?: boolean;
  /** Opts the report out of distributor scoping entirely. */
  disableValidation?: boolean;
}

/**
 * The distributor code a distributor-view report defaults to when the user has
 * picked no distributor of their own — the logged-in user's own login id, which
 * the datastream matches against `distributor_code`.
 *
 * Returns '' when the report is not distributor-scoped, when it opts out via
 * `disableValidation`, or when the session carries no login id. Callers treat
 * that as "no default scope" and send nothing, rather than sending a blank
 * value that would match no rows.
 *
 * Every request that returns report data has to apply this the same way. The
 * download path did and the preview and filter-value paths did not, so one
 * session could download rows scoped to itself while the preview showed none
 * and the filter dropdowns offered every distributor's values.
 */
export function defaultDistributorScope(config: DistributorScopeConfig): string[] {
  if (!config.isDistributorView) return [];
  if (config.disableValidation === true) return [];
  const { loginId } = getAuthContext();
  const trimmed = (loginId ?? '').trim();
  return trimmed ? [trimmed] : [];
}

/**
 * Applies {@link defaultDistributorScope} to a filter map, leaving an explicit
 * selection alone.
 *
 * Mutates and returns `filters` so callers can use it inline while building a
 * payload.
 */
export function withDefaultDistributorScope(
  filters: Record<string, string[]>,
  config: DistributorScopeConfig,
): Record<string, string[]> {
  const existing = filters[DISTRIBUTOR_FILTER_KEY];
  if (existing && existing.length > 0 && existing[0] !== '') return filters;

  const scope = defaultDistributorScope(config);
  if (scope.length > 0) filters[DISTRIBUTOR_FILTER_KEY] = scope;
  return filters;
}
