import { t } from '@lingui/core/macro';
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
const productName = (market: PendleMarketConfig) => `PT-${market.underlyingSymbol}`;
const form: UseEarnModalOptions<PendleMarketConfig, never>['form'] = ({ sessionId, flow, args }) => (
  <PendleModalForm sessionId={sessionId} flow={flow} market={args} />
);
const extra: UseEarnModalOptions<PendleMarketConfig, never>['extra'] = flow =>
  flow === 'supply'
    ? {}
    : {
        // Pre-maturity the only withdrawal IS an early one (matured positions
        // go through the redeem flow); the `review` subtitle renders on both
        // first screens (Figma 2193:73598 / 2193:73807). It is the one
        // disclosure the modal carries as a subtitle — the wallet/status
        // screens narrate through the step list instead (Design QA, Sep 2026).
        title: t`Early withdrawal`,
        subtitles: {
          review: t`Early withdrawal is settled at the current market price, not your locked-in rate. Your final amount may be lower than shown if market conditions change before the transaction confirms.`
        }
      };

/**
 * Reusable trigger for the editable Pendle supply/withdraw modal (buy/sell on
 * TransactionContext.launch, E1). PT markets are many, so the market is passed
 * to `openSupply`/`openWithdraw` at call time — the same launcher can open the
 * modal for any market. Markets are mainnet-only — the modal is guarded off
 * any L2 (APP-528).
 *
 * The launch config carries no `analytics`: the form fires the legacy widget
 * event set (REVIEW_VIEWED / TRANSACTION_*) itself with live amounts, keeping
 * exact event parity with the retired PendleWidget orchestration — a
 * launch-time `analytics` blob would double-fire those events with stale data.
 */
export function usePendleModal({ onSuccess }: UsePendleModalOptions = {}) {
  return useEarnModal<PendleMarketConfig, never>({
    productName,
    supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
    form,
    extra,
    onSuccess
  });
}
