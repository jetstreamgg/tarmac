import { useCallback } from 'react';
import { chainIdsForIntent } from '@/lib/chainAvailability';
import { Intent } from '@/lib/enums';
import { useEarnModal, type UseEarnModalOptions } from '@/modules/ui/hooks/useEarnModal';
import { SavingsModalForm, type SavingsModalPreset } from '../components/SavingsModalForm';

// Savings is a multi-chain product (mainnet + every supported L2). Switching
// among these chains is legitimate and the form re-resolves; the guard only
// fires if the wallet reaches a chain that offers no Savings at all (APP-528).
const SAVINGS_SUPPORTED_CHAIN_IDS = chainIdsForIntent(Intent.SAVINGS_INTENT);

const productName = () => 'Sky Savings';
const form: UseEarnModalOptions<void, SavingsModalPreset>['form'] = ({ sessionId, flow, preset }) => (
  <SavingsModalForm sessionId={sessionId} flow={flow} preset={preset} />
);

type UseSavingsModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable Savings supply/withdraw modal. Any surface
 * (the position card, Portfolio quick-deposit, …) calls this instead of
 * re-declaring the launch config. Pass a `preset` to seed the amount/token, or
 * omit it to open empty.
 */
export function useSavingsModal({ onSuccess }: UseSavingsModalOptions = {}) {
  const modal = useEarnModal<void, SavingsModalPreset>({
    productName,
    supportedChainIds: SAVINGS_SUPPORTED_CHAIN_IDS,
    form,
    onSuccess
  });
  const openSupply = useCallback(
    (preset?: SavingsModalPreset) => modal.openSupply(undefined, preset),
    [modal]
  );
  const openWithdraw = useCallback(
    (preset?: SavingsModalPreset) => modal.openWithdraw(undefined, preset),
    [modal]
  );
  return { openSupply, openWithdraw };
}
