/**
 * Max borrow — legacy Borrow.tsx:359-375 verbatim: debt-ceiling headroom
 * (total debt padded 0.001% for rate drift) capped by the collateral's safe
 * max. Frozen legacy math (F4 parity), shared by both takeover containers so
 * exactly one copy exists.
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
  return { fromDebtCeiling, balance: fromDebtCeiling > fromCollateral ? fromCollateral : fromDebtCeiling };
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
