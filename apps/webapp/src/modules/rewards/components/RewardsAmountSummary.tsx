import { formatUnits } from 'viem';
import { type Token } from '@/hooks';
import { formatNumber } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * Compact amount summary shown on the rewards modal's wallet/status screen
 * ("Confirm in the wallet") — the supply-token icon, the entered amount, and its
 * USD value. Mirrors the savings/vault wallet-screen summaries; the supply token
 * (USDS) is $1-pegged so USD ≈ amount.
 */
export function RewardsAmountSummary({
  supplyToken,
  amount,
  decimals
}: {
  supplyToken: Token;
  amount: bigint;
  decimals: number;
}) {
  const value = parseFloat(formatUnits(amount, decimals));
  const formatted = formatNumber(value, { maxDecimals: 2 });

  return (
    <div className="flex items-center gap-3" data-testid="rewards-amount-summary">
      <TokenIcon
        token={{ symbol: supplyToken.symbol }}
        width={40}
        showChainIcon={false}
        className="h-10 w-10"
      />
      <div className="flex flex-col">
        <Text className="text-text text-xl font-medium">
          {formatted} {supplyToken.symbol}
        </Text>
        <Text className="text-textSecondary text-sm">${formatted}</Text>
      </div>
    </div>
  );
}
