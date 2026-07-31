import { ReactNode } from 'react';
import { formatUnits } from 'viem';
import { type Token } from '@/hooks';
import { formatNumber } from '@/utils';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';

/**
 * Amount hero for the vault modal's review + wallet/status screens (Figma
 * 859:38559 / 859:38240): "Supply amount" / "Withdrawal amount" label, 32px
 * asset icon, Heading-2 amount, and the right-aligned asset badge pill — the
 * shared `TransactionAmountHero` treatment, mirroring `SavingsAmountSummary`.
 */
export function VaultAmountSummary({
  label,
  assetToken,
  amount,
  decimals
}: {
  label: ReactNode;
  assetToken: Token;
  amount: bigint;
  decimals: number;
}) {
  const formatted = formatNumber(parseFloat(formatUnits(amount, decimals)), { maxDecimals: 2 });
  return (
    <TransactionAmountHero
      label={label}
      amount={formatted}
      symbol={assetToken.symbol}
      dataTestId="vault-amount-summary"
    />
  );
}
