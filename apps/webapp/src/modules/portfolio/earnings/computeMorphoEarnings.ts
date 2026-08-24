import { MorphoTransactionType } from '../../../hooks/morpho/constants';
import type {
  MorphoNumberish,
  MorphoUserVaultV2Position,
  MorphoVaultV2Transaction
} from '../../../hooks/morpho/morpho';
import { notAvailable, ok, type EarningsFigure, type EarningsWindow, type Maybe } from './types';

export type MorphoEarningsInput = {
  positions: MorphoUserVaultV2Position[];
  transactions: MorphoVaultV2Transaction[];
  vaultAddress: string;
  window: EarningsWindow;
};

export type MorphoEarnings = {
  totalEarned: Maybe<EarningsFigure>;
  earnedThisMonth: Maybe<EarningsFigure>;
};

const units = (value: MorphoNumberish, decimals: number): number => Number(value) / 10 ** decimals;

/**
 * Single-vault earnings from the Morpho API; the aggregator calls this once
 * per supported vault. Total comes straight from the position's pnl/pnlUsd
 * (kept even after a full exit, so closed positions still count — the combined
 * figure may exceed the sum of visible position cards).
 * Monthly is the flows method: endAssets − baseline − Σdeposits + Σwithdrawals,
 * where baseline is the newest history sample at or before startSec (0 when the
 * position opened mid-window). No such sample — series empty (a position opened
 * today has flows before its first history sample lands, review finding #9) or
 * starting after startSec — is fine only when the window's flows explain the
 * end balance within tolerance. Beyond that, no baseline while balance or flows
 * exist → notAvailable('reconciliation-failed'), never a guessed number: a
 * long-standing position with a truncated series must not render its whole
 * balance as this month's earnings (post-merge review finding #1).
 */
export function computeMorphoEarnings({
  positions,
  transactions,
  vaultAddress,
  window
}: MorphoEarningsInput): MorphoEarnings {
  const wanted = vaultAddress.toLowerCase();
  const position = positions.find(p => p.vault.address.toLowerCase() === wanted);
  // Never touched the vault → genuinely earned nothing (asset symbol unknown, USD-only zero).
  if (!position) return { totalEarned: ok({ usd: 0 }), earnedThisMonth: ok({ usd: 0 }) };

  const { symbol, decimals } = position.vault.asset;
  const totalNative = units(position.pnl, decimals);
  const totalEarned = ok({ usd: position.pnlUsd, native: { amount: totalNative, symbol } });

  const flows = transactions.filter(
    t =>
      t.vault.address.toLowerCase() === wanted &&
      t.timestamp >= window.startSec &&
      t.timestamp <= window.endSec
  );
  let deposits = 0;
  let withdrawals = 0;
  for (const t of flows) {
    const amount = units(t.data.assets, decimals);
    if (t.type === MorphoTransactionType.Deposit) deposits += amount;
    else withdrawals += amount;
  }

  const endAssets = units(position.assets, decimals);
  const series = position.history?.assets ?? [];
  const atOrBefore = series.filter(pt => pt.x <= window.startSec);

  let baseline = 0;
  if (atOrBefore.length > 0) {
    baseline = units(atOrBefore.reduce((a, b) => (b.x > a.x ? b : a)).y, decimals);
  } else {
    // No baseline sample — whether the series is empty or starts after
    // startSec makes no difference. Baseline 0 is trustworthy only if the
    // flows account for the end balance: the residual is then same-window
    // yield, which even at an extreme APR stays far under 1% of the window's
    // activity. A larger residual means the position predates the window and
    // its history is missing, not merely young — rendering the whole balance
    // as this month's earnings would be the worst possible wrong number.
    const residual = Math.abs(endAssets - deposits + withdrawals);
    const explainedByFlows = flows.length > 0 && residual <= 0.01 * (endAssets + deposits + withdrawals);
    if ((endAssets > 0 || flows.length > 0) && !explainedByFlows) {
      return { totalEarned, earnedThisMonth: notAvailable('reconciliation-failed') };
    }
  }

  const monthNative = endAssets - baseline - deposits + withdrawals;

  // Implied asset price: live balance first, else the pnl pair (survives full exits).
  const rate =
    endAssets > 0 ? position.assetsUsd / endAssets : totalNative !== 0 ? position.pnlUsd / totalNative : null;
  if (rate === null && monthNative !== 0) {
    return { totalEarned, earnedThisMonth: notAvailable('reconciliation-failed') };
  }

  return {
    totalEarned,
    earnedThisMonth: ok({
      usd: rate === null ? 0 : monthNative * rate,
      native: { amount: monthNative, symbol }
    })
  };
}
