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
