import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import type { PendleMarketConfig } from '@/hooks/pendle/pendle';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { PendleModalForm } from '../components/PendleModalForm';

export type UsePendleModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable Pendle supply/withdraw modal — the Pendle
 * analogue of `useVaultModal` (buy/sell on TransactionContext.launch, E1). Each
 * opener mints its own session so sibling modals never cross-talk.
 *
 * Like vaults, PT markets are many, so the market is passed to
 * `openSupply`/`openWithdraw` at call time (not hook time) — the same launcher
 * can open the modal for any market (the market page card, the Portfolio
 * cards, …).
 *
 * The launch config carries no `analytics`: the form fires the legacy widget
 * event set (REVIEW_VIEWED / TRANSACTION_*) itself with live amounts, keeping
 * exact event parity with the retired PendleWidget orchestration — a
 * launch-time `analytics` blob would double-fire those events with stale data.
 */
export function usePendleModal({ onSuccess }: UsePendleModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const openSupply = useCallback(
    (market: PendleMarketConfig) => {
      // Figma titles the modals by the PT naming convention ("Supply to
      // PT-sUSDS", 859:41120), not the market's marketing name ("Fixed Yield").
      const ptName = `PT-${market.underlyingSymbol}`;
      launch({
        title: t`Supply to ${ptName}`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your supply is being processed on the blockchain. Please wait.`,
          success: t`You've successfully supplied to ${ptName}.`,
          error: t`An error occurred while supplying to ${ptName}.`
        },
        sessionId: supplySessionId,
        reviewTitle: t`Review supply`,
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        // Nothing entered yet; the form keeps this live (enhanced screening, APP-517).
        usdValue: 0,
        confirmLabel: t`Confirm`,
        // The editable body lives outside the dialog (hidden host) so its in-flight
        // hook survives minimize; it portals its inputs into the modal's entry slot.
        backgroundContent: <PendleModalForm sessionId={supplySessionId} flow="supply" market={market} />,
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, supplySessionId, onSuccess]
  );

  const openWithdraw = useCallback(
    (market: PendleMarketConfig) => {
      const ptName = `PT-${market.underlyingSymbol}`;
      launch({
        // Pre-maturity the only withdrawal IS an early one (matured positions
        // go through the redeem flow); the `review` subtitle renders on both
        // first screens (Figma 2193:73598 / 2193:73807).
        title: t`Early withdrawal`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          review: t`Early withdrawal is settled at the current market price, not your locked-in rate. Your final amount may be lower than shown if market conditions change before the transaction confirms.`,
          loading: t`Your withdrawal is being processed on the blockchain. Please wait.`,
          success: t`You've successfully withdrawn from ${ptName}.`,
          error: t`An error occurred while withdrawing from ${ptName}.`
        },
        sessionId: withdrawSessionId,
        reviewTitle: t`Review withdrawal`,
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        // Nothing entered yet; the form keeps this live (enhanced screening, APP-517).
        usdValue: 0,
        confirmLabel: t`Confirm`,
        backgroundContent: <PendleModalForm sessionId={withdrawSessionId} flow="withdraw" market={market} />,
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, withdrawSessionId, onSuccess]
  );

  return { openSupply, openWithdraw };
}
