import { useEffect } from 'react';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import type { UpgradeSourceToken } from '@/hooks';
import { useUpgradeModal } from './useUpgradeModal';

const UPGRADE_PARAM_TOKENS: Record<string, UpgradeSourceToken> = {
  dai: 'DAI',
  mkr: 'MKR'
};

/**
 * Consumes the `?upgrade=dai|mkr` deep link: opens the Upgrade DAI/MKR modal
 * with the source token preselected, then strips the param so the modal state
 * never lingers in the URL (the modal has no destination of its own — the
 * param is the shareable-link seam fenris85 asked for on APP-413). The param
 * is consumed whenever it appears, so in-app navigations that set it also
 * launch the modal; unknown values are dropped without opening.
 */
export function useUpgradeDeepLink() {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const { open } = useUpgradeModal();

  useEffect(() => {
    const value = searchParams.get(QueryParams.Upgrade);
    if (value === null) return;
    const token = UPGRADE_PARAM_TOKENS[value.toLowerCase()];
    if (token) open(token);
    setSearchParams(
      params => {
        params.delete(QueryParams.Upgrade);
        return params;
      },
      { replace: true }
    );
  }, [searchParams, open, setSearchParams]);
}
