import { useCallback, useId } from 'react';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { StUsdsFlow, type StUsdsModalPreset } from '../components/StUsdsFlow';

type UseStUsdsModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable stUSDS supply/withdraw modal — the stUSDS
 * analogue of `useSavingsModal` (stUSDS is a singleton product, so there are no
 * call-time args). Any surface (the position card, Portfolio quick-deposit, …)
 * calls this.
 */
export function useStUsdsModal({ onSuccess }: UseStUsdsModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const openSupply = useCallback(
    (preset?: StUsdsModalPreset) =>
      launch({
        sessionId: supplySessionId,
        // stUSDS is a mainnet-only product — guard the modal off any L2 (APP-528).
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        flow: <StUsdsFlow flow="supply" preset={preset} onSuccess={onSuccess} />
      }),
    [launch, supplySessionId, onSuccess]
  );

  const openWithdraw = useCallback(
    (preset?: StUsdsModalPreset) =>
      launch({
        sessionId: withdrawSessionId,
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        flow: <StUsdsFlow flow="withdraw" preset={preset} onSuccess={onSuccess} />
      }),
    [launch, withdrawSessionId, onSuccess]
  );

  return { openSupply, openWithdraw };
}
