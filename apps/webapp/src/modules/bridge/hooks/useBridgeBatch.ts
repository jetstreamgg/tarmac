import { useSafeWalletStatus } from '@/hooks';
import { useBatchSupportPending, useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';

/**
 * Whether a bridge's legs go out as one bundle: the user's batch setting on a
 * wallet that supports it, never a Safe or a wallet not known yet not to be
 * one. `batchPending` while the Safe read is still out on this chain (after a
 * network switch) or, for a wallet known not to be a Safe, while its batch
 * support is still being probed, so the legs wait instead of going out one at a time.
 */
export function useBridgeBatch() {
  const safeStatus = useSafeWalletStatus();
  const notSafe = safeStatus === 'not-safe';
  const batch = useShouldUseBatch(notSafe);
  const supportPending = useBatchSupportPending();
  return { batch, batchPending: safeStatus === 'checking' || (notSafe && supportPending) };
}
