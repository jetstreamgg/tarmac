import { formatUnits } from 'viem';
import { formatNumber } from '@/utils';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';

/**
 * Compact amount summary shown on the stUSDS modal's wallet/status screen
 * ("Confirm in the wallet") — the shared hero treatment (Figma 1036:208089).
 * Both legs are USDS-denominated and $1-pegged, so USD ≈ amount.
 */
export function StUsdsAmountSummary({ amount }: { amount: bigint }) {
  const formatted = formatNumber(parseFloat(formatUnits(amount, 18)), { maxDecimals: 2 });

  return (
    <TransactionAmountHero
      amount={formatted}
      symbol="USDS"
      usd={formatted}
      dataTestId="stusds-amount-summary"
    />
  );
}
