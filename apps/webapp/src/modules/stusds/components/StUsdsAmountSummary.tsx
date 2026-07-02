import { formatUnits } from 'viem';
import { formatNumber } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * Compact amount summary shown on the stUSDS modal's wallet/status screen
 * ("Confirm in the wallet") — mirrors the savings/vault wallet-screen summary.
 * Both legs are USDS-denominated and $1-pegged, so USD ≈ amount.
 */
export function StUsdsAmountSummary({ amount }: { amount: bigint }) {
  const formatted = formatNumber(parseFloat(formatUnits(amount, 18)), { maxDecimals: 2 });

  return (
    <div className="flex items-center gap-3" data-testid="stusds-amount-summary">
      <TokenIcon token={{ symbol: 'USDS' }} width={40} showChainIcon={false} className="h-10 w-10" />
      <div className="flex flex-col">
        <Text className="text-text text-xl font-medium">{formatted} USDS</Text>
        <Text className="text-textSecondary text-sm">${formatted}</Text>
      </div>
    </div>
  );
}
