import { formatUnits } from 'viem';
import { formatNumber } from '@/utils';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import type { StUsdsLaunchFlow } from '../hooks/useStUsdsLaunch';

const format = (units: bigint) =>
  formatNumber(parseFloat(formatUnits(units, 18)), { minDecimals: 2, maxDecimals: 2 });

const NO_VALUE = '–';

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
  /**
   * The stUSDS leg from the selected quote (18-dec) — output on supply, input
   * on withdraw. Absent while no quote is live (loading, refetching, all
   * providers blocked): the hero then shows the placeholder rather than a
   * fabricated 0.00 that reads as a real quote.
   */
  stUsdsAmount?: bigint;
}) {
  const usds = { symbol: 'USDS', amount: format(amount) };
  const stUsds = { symbol: 'stUSDS', amount: stUsdsAmount !== undefined ? format(stUsdsAmount) : NO_VALUE };
  const [from, to] = flow === 'supply' ? [usds, stUsds] : [stUsds, usds];

  return (
    <TokenTransferHero
      from={{ ...from, testId: 'stusds-amount-summary-from' }}
      to={{ ...to, testId: 'stusds-amount-summary-to' }}
      testId="stusds-amount-summary"
    />
  );
}
