import { useCallback, useId } from 'react';
import type { PendleMarketConfig } from '@/hooks/pendle/pendle';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { PendleTradeFlow } from '../components/PendleTradeFlow';

export type UsePendleModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable Pendle supply/withdraw modal — the Pendle
 * analogue of `useVaultModal` (buy/sell, E1).
 *
 * Like vaults, PT markets are many, so the market is passed to
 * `openSupply`/`openWithdraw` at call time (not hook time) — the same launcher
 * can open the modal for any market (the market page card, the Portfolio
 * cards, …).
 *
 * The flow passes the modal no `analytics`: it fires the legacy widget event set
 * (REVIEW_VIEWED / TRANSACTION_*) itself with live amounts, for exact parity with
 * the retired PendleWidget orchestration.
 */
export function usePendleModal({ onSuccess }: UsePendleModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const openSupply = useCallback(
    (market: PendleMarketConfig) =>
      launch({
        sessionId: supplySessionId,
        // Pendle PT markets are mainnet-only — guard the modal off any L2 (APP-528).
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        flow: <PendleTradeFlow flow="supply" market={market} onSuccess={onSuccess} />
      }),
    [launch, supplySessionId, onSuccess]
  );

  const openWithdraw = useCallback(
    (market: PendleMarketConfig) =>
      launch({
        sessionId: withdrawSessionId,
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        flow: <PendleTradeFlow flow="withdraw" market={market} onSuccess={onSuccess} />
      }),
    [launch, withdrawSessionId, onSuccess]
  );

  return { openSupply, openWithdraw };
}
