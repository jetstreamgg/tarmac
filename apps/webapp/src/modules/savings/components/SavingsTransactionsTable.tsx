import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { formatDistanceToNowStrict } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { useSavingsHistory, getTokenDecimals, TransactionTypeEnum } from '@/hooks';
import { formatBigInt, isL2ChainId, getEtherscanLink, formatAddress } from '@/utils';
import { absBigInt } from '@/modules/utils/math';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import {
  ProductTransactionsTable,
  ProductTransactionRow,
  ProductTransactionAmount
} from '@/components/product/ProductTransactionsTable';

/**
 * Maps the Savings history hook onto the reworked ProductTransactionsTable
 * (ProductDetailTemplate `transactions` slot). Status is always "completed" for
 * now — confirmed on-chain history only; pending in-flight txs are a later
 * ticket (C3 decision). The sUSDS side reuses the USDS amount as an
 * approximation; precise share amounts land with the D3 launch() migration.
 */
export function SavingsTransactionsTable() {
  const subgraphUrl = useSubgraphUrl();
  const { data: savingsHistory, isLoading, error } = useSavingsHistory(subgraphUrl);
  const chainId = useChainId();

  const rows = useMemo<ProductTransactionRow[]>(() => {
    if (!savingsHistory) return [];

    return savingsHistory.map(s => {
      const isSupply = s.type === TransactionTypeEnum.SUPPLY;
      const decimals = isL2ChainId(chainId) ? getTokenDecimals(s.token, chainId) : 18;
      const amount = formatBigInt(absBigInt(s.assets), { unit: decimals });
      const usd = `$${amount}`; // USDS ≈ $1
      const usdsSymbol = isL2ChainId(chainId) ? s.token.symbol : 'USDS';

      const usds: ProductTransactionAmount = {
        icon: (
          <TokenIcon token={{ symbol: usdsSymbol }} width={20} showChainIcon={false} className="h-5 w-5" />
        ),
        amount,
        usd
      };
      const susds: ProductTransactionAmount = {
        icon: <TokenIcon token={{ symbol: 'sUSDS' }} width={20} showChainIcon={false} className="h-5 w-5" />,
        amount,
        usd
      };

      return {
        id: s.transactionHash,
        actionIcon: isSupply ? (
          <SavingsSupply width={16} height={15} />
        ) : (
          <ArrowDown width={12} height={16} className="light:fill-text fill-white" />
        ),
        actionLabel: isSupply ? <Trans>Supply</Trans> : <Trans>Withdraw</Trans>,
        timeAgo: formatDistanceToNowStrict(s.blockTimestamp, { addSuffix: true }),
        status: 'completed' as const,
        from: isSupply ? usds : susds,
        to: isSupply ? susds : usds,
        txHashLabel: formatAddress(s.transactionHash, 6, 4),
        txHref: getEtherscanLink(chainId, s.transactionHash, 'tx')
      };
    });
  }, [savingsHistory, chainId]);

  return (
    <ProductTransactionsTable
      dataTestId="savings-transactions"
      rows={rows}
      isLoading={isLoading}
      error={error}
    />
  );
}
