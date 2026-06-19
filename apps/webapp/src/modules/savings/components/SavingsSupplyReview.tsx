import { useChainId, useChains } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { Text } from '@/modules/layout/components/Typography';
import { SavingsAmountSummary } from './SavingsAmountSummary';
import { buildSupplyReviewRows } from './savingsModalRows';

const NO_VALUE = '–';

/**
 * Read-only "Review supply" content for the no-position Supply flow (Figma
 * 527:7812), rendered as the shared review modal's `transactionContent`. Shows the
 * amount being supplied as a header with its USD subvalue, then the Figma detail
 * rows (`You'll receive`, `APY`, `Est. earnings (1Y)`, `Product`, `Withdrawal`,
 * `Network`, `Network fee`). Est. earnings and Network fee are stubbed (no
 * projection / gas-estimate source yet — PRD Out of Scope). Confirming hands off to
 * the wallet/status screen.
 */
export function SavingsSupplyReview({
  amount,
  symbol,
  usd,
  youReceive,
  apy
}: {
  amount: string;
  symbol: string;
  /** Dollar value of the supplied amount, formatted without the `$` (e.g. "10,000.00"). Omit to hide the subvalue. */
  usd?: string;
  youReceive: string;
  apy: string;
}) {
  const chainId = useChainId();
  const chains = useChains();
  const network = chains.find(c => c.id === chainId)?.name ?? 'Ethereum';

  const rows = buildSupplyReviewRows({
    youReceive,
    apy,
    estEarnings: NO_VALUE,
    product: 'Sky Savings',
    withdrawal: 'Anytime',
    network,
    networkFee: NO_VALUE
  });

  return (
    <div className="flex flex-col gap-4" data-testid="savings-supply-review">
      {/* You supply — the amount header (Figma 527:7812). */}
      <SavingsAmountSummary
        label={<Trans>You supply</Trans>}
        amount={amount}
        symbol={symbol}
        usd={usd}
        usdTestId="savings-supply-review-usd"
      />

      <div className="flex flex-col gap-3">
        {rows.map(row => (
          <div
            key={row.label}
            className="flex items-center justify-between"
            data-testid={`savings-review-row-${row.label}`}
          >
            <Text className="text-textSecondary text-sm">{row.label}</Text>
            <Text className="text-text text-sm font-medium">{row.kind === 'single' ? row.value : ''}</Text>
          </div>
        ))}
      </div>
    </div>
  );
}
