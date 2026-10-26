import { useSafeWalletStatus } from '@/hooks';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';

/**
 * Whether a bridge's legs go out as one bundle: the user's batch setting on a
 * wallet that supports it, never a Safe or a wallet not known yet not to be
 * one. `batchPending` while the Safe read is still out on this chain (after a
 * network switch), so the legs wait for it instead of sending one at a time.
 */
export function useBridgeBatch() {
  const safeStatus = useSafeWalletStatus();
  const batch = useShouldUseBatch(safeStatus === 'not-safe');
  return { batch, batchPending: safeStatus === 'checking' };
}
