/**
 * Max repayable USDS — copied VERBATIM from the legacy
 * `widgets/StakeModuleWidget/components/Repay.tsx` (`calculateMaxRepayable`,
 * lines 348-375; do not import from the widget, it dies at F7). The dust-gap
 * rule: a repay may never strand a remainder in (0, dust), so when the balance
 * lands there the max claws back to debt − dust (or 0 if that is unreachable).
 */
export function calculateMaxRepayable({
  debtValue,
  dust,
  balance,
  partialMax
}: {
  debtValue: bigint | undefined;
  dust: bigint | undefined;
  balance: bigint | undefined;
  /** Largest partial `wipe` accepts (stored rate); defaults to debt − dust. */
  partialMax?: bigint;
}): bigint {
  if (!debtValue || !balance) {
    return 0n;
  }

  if (balance >= debtValue) {
    return debtValue;
  }

  const gapMax = debtValue - (dust || 0n);
  const maxPartial = partialMax !== undefined && partialMax < gapMax ? partialMax : gapMax;

  if (balance <= maxPartial) {
    return balance;
  }
  return maxPartial > 0n ? maxPartial : 0n;
}

/**
 * Which ways out of the dust gap a typed repay can offer (Figma 3297:71046):
 * `partial` when debt − dust (capped at the wallet) leaves something to repay
 * and keep the position open, `full` when the wallet covers the whole debt. Both false only when the
 * debt is already at or under dust with no wallet to close it.
 */
export function repayGapOptions({
  debtValue,
  dust,
  balance,
  partialMax: wipeMax
}: {
  debtValue: bigint;
  dust: bigint;
  balance: bigint | undefined;
  /** Largest partial `wipe` accepts (stored rate); defaults to debt − dust. */
  partialMax?: bigint;
}): { partialMax: bigint; partial: boolean; full: boolean } {
  const wallet = balance ?? 0n;
  const projectedGapMax = debtValue - dust;
  const gapMax = wipeMax !== undefined && wipeMax < projectedGapMax ? wipeMax : projectedGapMax;
  // Never quote a figure the wallet can't cover.
  const partialMax = wallet < gapMax ? wallet : gapMax;
  return { partialMax, partial: partialMax > 0n, full: wallet >= debtValue };
}
