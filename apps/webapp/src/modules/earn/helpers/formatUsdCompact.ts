import { formatNumber, formatUsd } from '@/utils';

/**
 * USD figure in the earn comps' compact style (1036:201322): `$4.71b` /
 * `$120.7k` with lowercase magnitude suffixes from 1000 up, plain two-decimal
 * money below that (`$0.00`).
 */
export function formatUsdCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 1000) return formatUsd(amount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${formatNumber(abs, { compact: true, amount: abs }).toLowerCase()}`;
}
