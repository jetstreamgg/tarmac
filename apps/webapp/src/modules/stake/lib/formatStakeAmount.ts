import { formatBigInt, WAD_PRECISION } from '@/utils';
import { NO_VALUE } from '@/lib/constants';

/**
 * Table amount formatting for the Stake surfaces: zero renders as `0.00`
 * (hi-fi 486:31830 shows explicit 0.00 cells), everything else goes through
 * the app-wide formatter.
 */
export function formatStakeAmount(amount: bigint): string {
  return amount === 0n ? '0.00' : formatBigInt(amount);
}

/**
 * Oracle price (WAD) for the stat cells — 4 decimals pinned, because the
 * magnitude-driven default would drop to 2 the moment a price crosses $10.
 */
export function formatOraclePrice(value: bigint | undefined): string {
  return value !== undefined ? `$${formatBigInt(value, { unit: WAD_PRECISION, maxDecimals: 4 })}` : NO_VALUE;
}
