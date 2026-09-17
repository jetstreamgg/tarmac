import type { PendleMarketConfig } from '@/hooks/pendle/pendle';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useEarnModal, type UseEarnModalOptions } from '@/modules/ui/hooks/useEarnModal';
import { PendleModalForm } from '../components/PendleModalForm';

export type UsePendleModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

// Figma titles the modals by the PT naming convention ("Supply to PT-sUSDS",
// 859:41120), not the market's marketing name ("Fixed Yield").
const form: UseEarnModalOptions<PendleMarketConfig, never>['form'] = ({ flow, args, onSuccess }) => (
  <PendleModalForm flow={flow} market={args} onSuccess={onSuccess} />
);

/**
 * Reusable trigger for the editable Pendle supply/withdraw modal (buy/sell on
 * TransactionContext.launch, E1). PT markets are many, so the market is passed
 * to `openSupply`/`openWithdraw` at call time — the same launcher can open the
 * modal for any market. Markets are mainnet-only — the modal is guarded off
 * any L2 (APP-528).
 *
 * The form fires the legacy widget event set (REVIEW_VIEWED / TRANSACTION_*)
 * itself with live amounts, so it renders the modal with no `analytics`.
 */
export function usePendleModal({ onSuccess }: UsePendleModalOptions = {}) {
  return useEarnModal<PendleMarketConfig, never>({
    supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
    form,
    onSuccess
  });
}
