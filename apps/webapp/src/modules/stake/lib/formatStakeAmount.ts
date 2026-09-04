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
 * Oracle price (WAD) for the stat cells — exactly 4 decimals: the
 * magnitude-driven default would drop to 2 the moment a price crosses $10,
 * and a trimmed tail (`$0.05` next to `$0.0478`) changed the cell's width as
 * the slider moved, which is what made the stat row reflow under the pointer
 * (APP-546).
 */
export function formatOraclePrice(value: bigint | undefined): string {
  return value !== undefined
    ? `$${formatBigInt(value, { unit: WAD_PRECISION, maxDecimals: 4, minDecimals: 4 })}`
    : NO_VALUE;
}
