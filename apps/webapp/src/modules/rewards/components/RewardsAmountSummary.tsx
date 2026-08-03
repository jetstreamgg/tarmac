import { ReactNode } from 'react';
import { formatUnits } from 'viem';
import { type Token } from '@/hooks';
import { formatNumber } from '@/utils';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';

/**
 * "<label> / [icon] <amount> / badge" amount hero for the rewards transaction
 * modal — the shared hero treatment (DS Modal comp 1310:130565). Two uses:
 *  - the header above the review breakdown, and
 *  - the amount summary on the wallet/status screen.
 * No USD sub-line: the DS hero comps draw label + amount + badge only,
 * matching the Savings modal.
 */
export function RewardsAmountSummary({
  label,
  supplyToken,
  amount,
  decimals
}: {
  label: ReactNode;
  supplyToken: Token;
  amount: bigint;
  decimals: number;
}) {
  const formatted = formatNumber(parseFloat(formatUnits(amount, decimals)), { maxDecimals: 2 });
  return (
    <TransactionAmountHero
      label={label}
      amount={formatted}
      symbol={supplyToken.symbol}
      dataTestId="rewards-amount-summary"
    />
  );
}
