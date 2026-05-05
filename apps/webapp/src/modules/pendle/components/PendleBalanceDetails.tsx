import { t } from '@lingui/core/macro';
import { erc20Abi, zeroAddress } from 'viem';
import { useChainId, useConnection, useReadContract } from 'wagmi';
import { mainnet } from 'viem/chains';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { usePendleUserPtBalances, type PendleMarketConfig } from '@jetstreamgg/sky-hooks';
import { SuppliedBalanceCard, UnsuppliedBalanceCard } from '@/modules/ui/components/BalanceCards';

type PendleBalanceDetailsProps = {
  market: PendleMarketConfig;
};

// PT decimals match underlying decimals (see SupplyWithdraw.tsx for context).

export const PendleBalanceDetails = ({ market }: PendleBalanceDetailsProps) => {
  const { address } = useConnection();
  const chainId = useChainId();
  const balanceChainId = isTestnetId(chainId) ? chainId : mainnet.id;

  const { data: balances, isLoading: ptLoading } = usePendleUserPtBalances();
  const ptBalance = balances?.[market.marketAddress];

  const { data: walletUnderlying, isLoading: underlyingLoading } = useReadContract({
    abi: erc20Abi,
    address: market.underlyingToken,
    functionName: 'balanceOf',
    args: [address ?? zeroAddress],
    chainId: balanceChainId,
    query: { enabled: !!address }
  });

  const ptToken = {
    name: `PT-${market.underlyingSymbol}`,
    symbol: `PT-${market.underlyingSymbol}`,
    decimals: market.underlyingDecimals
  };
  const underlyingToken = {
    name: market.underlyingSymbol,
    symbol: market.underlyingSymbol,
    decimals: market.underlyingDecimals
  };

  return (
    <div className="flex w-full flex-col justify-between gap-3 xl:flex-row">
      <SuppliedBalanceCard
        balance={ptBalance ?? 0n}
        isLoading={ptLoading}
        token={ptToken}
        label={t`Pendle PT balance`}
        dataTestId="pendle-supplied-balance-details"
      />
      <UnsuppliedBalanceCard
        balance={walletUnderlying ?? 0n}
        isLoading={underlyingLoading}
        token={underlyingToken}
        dataTestId="pendle-remaining-balance-details"
      />
    </div>
  );
};
