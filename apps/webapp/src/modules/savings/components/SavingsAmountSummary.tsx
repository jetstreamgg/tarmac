import { ReactNode } from 'react';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Text } from '@/modules/layout/components/Typography';

/**
 * Compact "<label> / [icon] <amount> <symbol> / $<usd>" amount header for the
 * Savings transaction modal. Two uses (Figma 527:7812 / "Confirm in the wallet"):
 *  - the "You supply" header above the review breakdown, and
 *  - the "Supply amount" / "Withdrawal amount" summary on the wallet/status screen,
 *    where Figma replaces the full breakdown with just this header.
 *
 * Pure presentation; test-ids are caller-supplied so each mount keeps its own
 * stable hooks.
 */
export function SavingsAmountSummary({
  label,
  amount,
  symbol,
  usd,
  dataTestId,
  usdTestId
}: {
  label: ReactNode;
  amount: string;
  symbol: string;
  /** Dollar value of the amount, formatted without the `$` (e.g. "10,000.00"). Omit to hide. */
  usd?: string;
  dataTestId?: string;
  usdTestId?: string;
}) {
  return (
    <div className="flex flex-col gap-1" data-testid={dataTestId}>
      <Text className="text-textSecondary text-sm">{label}</Text>
      <div className="flex items-center gap-2">
        <TokenIcon className="h-7 w-7" token={{ symbol }} showChainIcon={false} />
        <span className="text-text text-2xl font-medium">{amount}</span>
        <span className="text-textSecondary text-lg font-medium">{symbol}</span>
      </div>
      {usd && (
        <Text className="text-textSecondary text-sm" data-testid={usdTestId}>
          ${usd}
        </Text>
      )}
    </div>
  );
}
