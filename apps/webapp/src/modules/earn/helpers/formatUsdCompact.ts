import { formatNumber, formatUsd } from '@/utils';

/**
 * USD figure in compact style: `$4.71B` / `$120.7K` from 1000 up, plain
 * two-decimal money below that (`$0.00`).
 */
export function formatUsdCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 1000) return formatUsd(amount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${formatNumber(abs, { compact: true })}`;
}
