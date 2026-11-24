import { t } from '@lingui/core/macro';
import type { PendleSyLimits } from '@/hooks';
import { formatBigInt } from '@/utils';

/**
 * The SY's configured withdrawal rate as copy: "50,000.00 USDS per hour". The
 * amount is the vault's asset, which the caller names and scales.
 */
export function pendleWithdrawRateLabel(
  withdraw: NonNullable<PendleSyLimits['withdraw']>,
  decimals: number,
  symbol: string
): string {
  const amount = formatBigInt(withdraw.rateAssets, { unit: decimals, maxDecimals: 2 });
  const seconds = withdraw.windowSeconds;
  if (seconds === 3600) return t`${amount} ${symbol} per hour`;
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return t`${amount} ${symbol} every ${hours} hours`;
  }
  const minutes = Math.round(seconds / 60);
  return t`${amount} ${symbol} every ${minutes} minutes`;
}
