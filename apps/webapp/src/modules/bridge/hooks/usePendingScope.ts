import { useConnection } from 'wagmi';
import { useAppChainId } from '@/hooks/ui/useAppChainId';
import { familyMainnetId } from '@/utils/isTestnetId';
import { pendingScopeKey } from '../store/pendingStore';

/** The connected account's pending-bridge scope; undefined while disconnected. */
export function usePendingScope() {
  const { address } = useConnection();
  // Same chain as the form, so the scope and the form agree when the wallet sits off the app's chains.
  const familyChainId = familyMainnetId(useAppChainId());
  return {
    account: address,
    familyChainId,
    scope: address ? pendingScopeKey({ account: address, familyChainId }) : undefined
  };
}
