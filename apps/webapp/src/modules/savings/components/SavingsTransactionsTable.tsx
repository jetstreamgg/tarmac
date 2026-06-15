import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import { formatDistanceToNowStrict } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { useSavingsHistory, useReadSavingsUsds, getTokenDecimals, TransactionTypeEnum } from '@/hooks';
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
 * ticket (C3 decision). The sUSDS side is converted at the current exchange
 * rate; the subgraph records only the USDS `assets`, so this uses today's rate,
 * not the per-tx historical rate.
 */
export function SavingsTransactionsTable() {
  const subgraphUrl = useSubgraphUrl();
  const { data: savingsHistory, isLoading, error } = useSavingsHistory(subgraphUrl);
  const chainId = useChainId();

  // sUSDS exchange rate: shares minted per 1 USDS (ERC4626 convertToShares).
  // Read on the ethereum chain (mainnet for L2s) — the rate is global, linear,
  // so we read it once and scale each row. Falls back to 1:1 while loading.
  const ethereumChainId = !isL2ChainId(chainId) ? chainId : 1;
  const { data: sharesPerUsds } = useReadSavingsUsds({
    functionName: 'convertToShares',
    args: [parseUnits('1', 18)],
    chainId: ethereumChainId as keyof typeof useReadSavingsUsds
  });

  const rows = useMemo<ProductTransactionRow[]>(() => {
    if (!savingsHistory) return [];

    return savingsHistory.map(s => {
      const isSupply = s.type === TransactionTypeEnum.SUPPLY;
      const decimals = isL2ChainId(chainId) ? getTokenDecimals(s.token, chainId) : 18;
      const assetsAbs = absBigInt(s.assets);
      // Convert the USDS amount to sUSDS shares at the current rate (linear;
      // 1:1 until the rate loads). USD value stays the USDS value for both sides.
      const sharesAbs = sharesPerUsds ? (assetsAbs * sharesPerUsds) / 10n ** 18n : assetsAbs;
      const usdsAmount = formatBigInt(assetsAbs, { unit: decimals });
      const susdsAmount = formatBigInt(sharesAbs, { unit: 18 });
      const usd = `$${usdsAmount}`; // USDS ≈ $1
      const usdsSymbol = isL2ChainId(chainId) ? s.token.symbol : 'USDS';

      const usds: ProductTransactionAmount = {
        icon: (
          <TokenIcon token={{ symbol: usdsSymbol }} width={20} showChainIcon={false} className="h-5 w-5" />
        ),
        amount: usdsAmount,
        usd
      };
      const susds: ProductTransactionAmount = {
        icon: <TokenIcon token={{ symbol: 'sUSDS' }} width={20} showChainIcon={false} className="h-5 w-5" />,
        amount: susdsAmount,
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
  }, [savingsHistory, chainId, sharesPerUsds]);

  return (
    <ProductTransactionsTable
      dataTestId="savings-transactions"
      rows={rows}
      isLoading={isLoading}
      error={error}
    />
  );
}
