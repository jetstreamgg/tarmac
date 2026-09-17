import { useCallback } from 'react';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useEarnModal, type UseEarnModalOptions } from '@/modules/ui/hooks/useEarnModal';
import { StUsdsModalForm, type StUsdsModalPreset } from '../components/StUsdsModalForm';

const productName = () => 'stUSDS';
const form: UseEarnModalOptions<void, StUsdsModalPreset>['form'] = ({ sessionId, flow, preset }) => (
  <StUsdsModalForm sessionId={sessionId} flow={flow} preset={preset} />
);

type UseStUsdsModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable stUSDS supply/withdraw modal (a singleton
 * product, so there are no call-time args). stUSDS is mainnet-only — the modal
 * is guarded off any L2 (APP-528).
 */
export function useStUsdsModal({ onSuccess }: UseStUsdsModalOptions = {}) {
  const modal = useEarnModal<void, StUsdsModalPreset>({
    productName,
    supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
    form,
    onSuccess
  });
  const openSupply = useCallback(
    (preset?: StUsdsModalPreset) => modal.openSupply(undefined, preset),
    [modal]
  );
  const openWithdraw = useCallback(
    (preset?: StUsdsModalPreset) => modal.openWithdraw(undefined, preset),
    [modal]
  );
  return { openSupply, openWithdraw };
}
