import { QueryParams } from '@/lib/constants';

/**
 * The Earn Opportunities filters a product page's "Back to products" link
 * should restore (APP-457).
 *
 * The browser back button needs nothing: the /earn history entry already
 * carries the filter params. The in-app back link is a *push*, though — kept
 * deliberately, because a history traversal is vetoed from view transitions
 * (pages/router.tsx), so `history.back()` would swap the pages with no drill
 * animation at all. A push has to be told where it is going, hence this.
 *
 * Lives in lib rather than modules/earn because both sides need it and
 * components/product may not import a module (the EarnTable layer rule).
 */

const STORAGE_KEY = 'earnFilterSearch';

/** Only the URL-driven filters; `risk` is a localStorage preference and survives on its own. */
const FILTER_PARAMS: string[] = [QueryParams.Token, QueryParams.Chain, QueryParams.Product];

export type EarnFilterSearch = Record<string, string>;

const pickFilterParams = (source: Record<string, unknown>): EarnFilterSearch => {
  const picked: EarnFilterSearch = {};
  for (const key of FILTER_PARAMS) {
    const value = source[key];
    if (typeof value === 'string' && value !== '') picked[key] = value;
  }
  return picked;
};

/**
 * Records what /earn is currently filtered by. Called with an empty object too
 * — that is what makes a clean landing (the navbar's Earn button) wipe the
 * memory, so no explicit clearing is needed anywhere.
 */
export function rememberEarnFilterSearch(search: EarnFilterSearch): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pickFilterParams(search)));
  } catch {
    // ignore storage write failures (private mode, quota)
  }
}

/** The remembered filters, or an empty object when there is nothing to restore. */
export function recallEarnFilterSearch(): EarnFilterSearch {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (typeof stored !== 'object' || stored === null) return {};
    return pickFilterParams(stored as Record<string, unknown>);
  } catch {
    return {};
  }
}
