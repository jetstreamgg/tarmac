import { formatUnits } from 'viem';
import { formatNumber } from '@/utils';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import type { StUsdsLaunchFlow } from '../hooks/useStUsdsLaunch';

const format = (units: bigint) =>
  formatNumber(parseFloat(formatUnits(units, 18)), { minDecimals: 2, maxDecimals: 2 });

/**
 * The from → to hero on the stUSDS modal's review and wallet screens — the
 * Upgrade/Convert token-swap treatment: supply moves USDS → stUSDS (the quoted
 * output), a withdraw redeems/swaps stUSDS (the quote-derived input) → USDS.
 */
export function StUsdsAmountSummary({
  flow,
  amount,
  stUsdsAmount
}: {
  flow: StUsdsLaunchFlow;
  /** Entered USDS amount (18-dec). */
  amount: bigint;
  /** The stUSDS leg from the selected quote (18-dec) — output on supply, input on withdraw. */
  stUsdsAmount: bigint;
}) {
  const usds = { symbol: 'USDS', amount: format(amount) };
  const stUsds = { symbol: 'stUSDS', amount: format(stUsdsAmount) };
  const [from, to] = flow === 'supply' ? [usds, stUsds] : [stUsds, usds];

  return (
    <TokenTransferHero
      from={{ ...from, testId: 'stusds-amount-summary-from' }}
      to={{ ...to, testId: 'stusds-amount-summary-to' }}
      testId="stusds-amount-summary"
    />
  );
}
