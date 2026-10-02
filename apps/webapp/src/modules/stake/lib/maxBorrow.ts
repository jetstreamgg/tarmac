import { WAD } from '@/utils';

/**
 * Max borrow — legacy Borrow.tsx:359-375: debt-ceiling headroom (total debt
 * padded 0.001% for rate drift) capped by the collateral's safe max, floored to
 * whole USDS. Shared by both takeover containers so exactly one copy exists.
 */
export function calculateAvailableBorrow(
  collateralData: { totalDaiDebt?: bigint; debtCeiling?: bigint } | undefined,
  maxSafeBorrowableIntAmount: bigint | undefined
): { fromDebtCeiling: bigint; balance: bigint } {
  const adjustedTotalDebt =
    collateralData?.totalDaiDebt !== undefined ? (collateralData.totalDaiDebt * 100001n) / 100000n : 0n;
  const fromDebtCeiling =
    collateralData?.debtCeiling !== undefined && collateralData?.totalDaiDebt !== undefined
      ? collateralData.debtCeiling - adjustedTotalDebt < 0n
        ? 0n
        : collateralData.debtCeiling - adjustedTotalDebt
      : 0n;
  const fromCollateral = maxSafeBorrowableIntAmount ?? 0n;
  const cap = fromDebtCeiling > fromCollateral ? fromCollateral : fromDebtCeiling;
  // Whole USDS like the collateral side: the dropped fraction is the margin that
  // keeps a Max borrow safe against the fee accrued before the tx mines.
  return { fromDebtCeiling, balance: (cap / WAD) * WAD };
}

/** Collateral at/below the dust-implied minimum — the min-collateral warning gate. */
export function isMinCollateralNotMet(
  vault: { collateralAmount?: bigint; minCollateralForDust?: bigint } | undefined
): boolean {
  return (
    vault?.collateralAmount !== undefined &&
    vault?.minCollateralForDust !== undefined &&
    vault.collateralAmount <= vault.minCollateralForDust
  );
}
