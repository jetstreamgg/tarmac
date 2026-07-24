import { ReactNode } from 'react';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';

/**
 * "<label> / [icon] <amount> / $<usd>" amount header for the Savings
 * transaction modal — the shared hero treatment (Figma 1036:208089). Two uses:
 *  - the "You supply" header above the review breakdown, and
 *  - the "Supply amount" / "Withdrawal amount" summary on the wallet/status screen,
 *    where Figma replaces the full breakdown with just this header.
 *
 * Pure presentation; test-ids are caller-supplied so each mount keeps its own
 * stable hooks.
 */
export function SavingsAmountSummary(props: {
  label: ReactNode;
  amount: string;
  symbol: string;
  /** Dollar value of the amount, formatted without the `$` (e.g. "10,000.00"). Omit to hide. */
  usd?: string;
  dataTestId?: string;
  usdTestId?: string;
}) {
  return <TransactionAmountHero {...props} />;
}
