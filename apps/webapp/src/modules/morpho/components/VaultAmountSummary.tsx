import { formatUnits } from 'viem';
import { type Token } from '@/hooks';
import { formatNumber } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * Compact amount summary shown on the vault modal's wallet/status screen
 * ("Confirm in the wallet") — the asset icon, the entered amount, and its USD
 * value. Mirrors the savings wallet-screen summary; the asset tokens are
 * $1-pegged so USD ≈ amount.
 */
export function VaultAmountSummary({
  assetToken,
  amount,
  decimals
}: {
  assetToken: Token;
  amount: bigint;
  decimals: number;
}) {
  const value = parseFloat(formatUnits(amount, decimals));
  const formatted = formatNumber(value, { maxDecimals: 2 });

  return (
    <div className="flex items-center gap-3" data-testid="vault-amount-summary">
      <TokenIcon
        token={{ symbol: assetToken.symbol }}
        width={40}
        showChainIcon={false}
        className="h-10 w-10"
      />
      <div className="flex flex-col">
        <Text className="text-text text-xl font-medium">
          {formatted} {assetToken.symbol}
        </Text>
        <Text className="text-textSecondary text-sm">${formatted}</Text>
      </div>
    </div>
  );
}
