import { useCallback, useId } from 'react';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { chainIdsForIntent } from '@/lib/chainAvailability';
import { Intent } from '@/lib/enums';
import { SavingsFlow, type SavingsModalPreset } from '../components/SavingsFlow';

// Savings is a multi-chain product (mainnet + every supported L2). Switching
// among these chains is legitimate and the form re-resolves; the guard only
// fires if the wallet reaches a chain that offers no Savings at all (APP-528).
const SAVINGS_SUPPORTED_CHAIN_IDS = chainIdsForIntent(Intent.SAVINGS_INTENT);

type UseSavingsModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable Savings supply/withdraw modal. Any surface
 * (the position card, Portfolio quick-deposit, …) calls this; pass a `preset` to
 * seed the amount/token, or omit it to open empty.
 */
export function useSavingsModal({ onSuccess }: UseSavingsModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const openSupply = useCallback(
    (preset?: SavingsModalPreset) =>
      launch({
        sessionId: supplySessionId,
        supportedChainIds: SAVINGS_SUPPORTED_CHAIN_IDS,
        flow: <SavingsFlow flow="supply" preset={preset} onSuccess={onSuccess} />
      }),
    [launch, supplySessionId, onSuccess]
  );

  const openWithdraw = useCallback(
    (preset?: SavingsModalPreset) =>
      launch({
        sessionId: withdrawSessionId,
        supportedChainIds: SAVINGS_SUPPORTED_CHAIN_IDS,
        flow: <SavingsFlow flow="withdraw" preset={preset} onSuccess={onSuccess} />
      }),
    [launch, withdrawSessionId, onSuccess]
  );

  return { openSupply, openWithdraw };
}
