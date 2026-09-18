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
  balance
}: {
  debtValue: bigint | undefined;
  dust: bigint | undefined;
  balance: bigint | undefined;
}): bigint {
  if (!debtValue || !balance) {
    return 0n;
  }

  const totalDebt = debtValue;
  const userBalance = balance;

  if (userBalance >= totalDebt) {
    return totalDebt;
  }

  const remainingDebt = totalDebt - userBalance;

  if (remainingDebt > 0n && remainingDebt < (dust || 0n)) {
    const maxRepayWithoutDust = totalDebt - (dust || 0n);

    if (userBalance >= maxRepayWithoutDust && maxRepayWithoutDust > 0n) {
      return maxRepayWithoutDust;
    } else {
      return 0n;
    }
  } else {
    return userBalance;
  }
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
  balance
}: {
  debtValue: bigint;
  dust: bigint;
  balance: bigint | undefined;
}): { partialMax: bigint; partial: boolean; full: boolean } {
  const wallet = balance ?? 0n;
  const gapMax = debtValue - dust;
  // Never quote a figure the wallet can't cover.
  const partialMax = wallet < gapMax ? wallet : gapMax;
  return { partialMax, partial: partialMax > 0n, full: wallet >= debtValue };
}
