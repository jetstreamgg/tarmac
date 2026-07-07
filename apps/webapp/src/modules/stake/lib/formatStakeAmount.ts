import { formatBigInt } from '@/utils';

/**
 * Table amount formatting for the Stake surfaces: zero renders as `0.00`
 * (hi-fi 486:31830 shows explicit 0.00 cells), everything else goes through
 * the app-wide formatter.
 */
export function formatStakeAmount(amount: bigint): string {
  return amount === 0n ? '0.00' : formatBigInt(amount);
}
