import { useChainId, useConnection } from 'wagmi';
import { familyMainnetId } from '@/utils/isTestnetId';
import { pendingScopeKey } from '../store/pendingStore';

/** The connected account's pending-bridge scope; undefined while disconnected. */
export function usePendingScope() {
  const { address } = useConnection();
  const familyChainId = familyMainnetId(useChainId());
  return {
    account: address,
    familyChainId,
    scope: address ? pendingScopeKey({ account: address, familyChainId }) : undefined
  };
}
