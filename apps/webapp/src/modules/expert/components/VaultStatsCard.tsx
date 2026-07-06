import { formatBigInt } from '@/utils';
import {
  Token,
  getTokenDecimals,
  useVaultMarketData,
  useErc4626VaultData,
  type VaultProvider
} from '@/hooks';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChainId, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { MorphoRateBreakdownPopover, SparkVaultRate, VaultPoweredByBadge } from '@/widgets';
import { Trans } from '@lingui/react/macro';

type VaultStatsCardProps = {
  vaultAddress: Record<number, `0x${string}`>;
  vaultName: string;
  assetToken: Token;
  /** Which provider operates the vault (branding + data source). Defaults to Morpho. */
  provider?: VaultProvider;
  onClick?: () => void;
  disabled?: boolean;
};

export const VaultStatsCard = ({
  vaultAddress,
  vaultName,
  assetToken,
  provider = 'morpho',
  onClick,
  disabled = false
}: VaultStatsCardProps) => {
  const chainId = useChainId();
  const assetDecimals = getTokenDecimals(assetToken, chainId);

  const currentVaultAddress = vaultAddress[chainId];

  const { data: marketData, isLoading: marketDataLoading } = useVaultMarketData({
    provider,
    vaultAddress: currentVaultAddress
  });

  // On-chain TVL + liquidity for providers without a market-data source yet (Spark).
  // Disabled for Morpho (it reads these from its API) so Morpho cards add no RPC calls.
  const { data: onChainData, isLoading: onChainLoading } = useErc4626VaultData({
    vaultAddress: provider === 'morpho' ? undefined : currentVaultAddress,
    provider
  });

  // Withdrawable liquidity = the USDT the vault currently holds (its un-deployed buffer).
  // TODO: revisit once the Spark API is live — its official liquidity figure may differ from this
  // on-chain balance (e.g. it could include funds recallable from the ALM). The dispatcher already
  // prefers `marketData?.liquidity` when present, so this on-chain read is just the fallback.
  const assetAddress = assetToken.address[chainId as keyof typeof assetToken.address];
  const { data: onChainLiquidity, isLoading: onChainLiquidityLoading } = useReadContract({
    address: provider === 'morpho' ? undefined : assetAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: currentVaultAddress ? [currentVaultAddress] : undefined,
    chainId,
    query: { enabled: provider !== 'morpho' && !!assetAddress && !!currentVaultAddress }
  });

  // Morpho sources TVL + liquidity from its market API; other providers (Spark) read them
  // on-chain so the card never hangs on a missing/placeholder API.
  const isExternalProvider = provider !== 'morpho';
  const totalAssets = marketData?.totalAssets ?? onChainData?.totalAssets;
  const tvlLoading = isExternalProvider ? onChainLoading : marketDataLoading;
  const liquidity = marketData?.liquidity ?? onChainLiquidity;
  const liquidityLoading = isExternalProvider ? onChainLiquidityLoading : marketDataLoading;

  if (!currentVaultAddress) {
    return null;
  }

  return (
    <Card
      className={`from-card to-card h-full bg-transparent bg-radial-(--gradient-position) transition-[background-color,background-image,opacity] lg:p-5 ${onClick && !disabled ? 'hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer' : ''} ${disabled ? 'opacity-50' : ''}`}
      onClick={disabled ? undefined : onClick}
      data-testid={`${provider}-vault-stats-card`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        {/* Left side - Title */}
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-6 w-6" token={{ symbol: assetToken.symbol }} />
          <Text>{vaultName}</Text>
          <VaultPoweredByBadge provider={provider} />
        </HStack>

        {/* Right side - Rate: Morpho from its API, Spark from the on-chain Vault Savings Rate. */}
        {provider === 'morpho' ? (
          <MorphoRateBreakdownPopover vaultAddress={currentVaultAddress} tooltipIconClassName="w-3 h-3" />
        ) : (
          <SparkVaultRate vaultAddress={currentVaultAddress} iconClassName="w-3 h-3" />
        )}
      </CardHeader>

      <CardContent className="mt-5 p-0">
        <HStack className="justify-between" gap={2}>
          {/* Liquidity */}
          <VStack className="items-stretch justify-between" gap={2} data-testid="liquidity-container">
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>Liquidity</Trans>
            </Text>
            {liquidityLoading ? (
              <Skeleton className="h-4 w-21" />
            ) : liquidity !== undefined ? (
              <Text dataTestId="morpho-vault-liquidity">
                {formatBigInt(liquidity, { unit: assetDecimals, compact: true })} {assetToken.symbol}
              </Text>
            ) : (
              <Text dataTestId="morpho-vault-liquidity">—</Text>
            )}
          </VStack>
          {/* TVL */}
          <VStack className="items-stretch justify-between text-right" gap={2} data-testid="tvl-container">
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>TVL</Trans>
            </Text>
            {tvlLoading ? (
              <div className="flex justify-end">
                <Skeleton className="h-4 w-30" />
              </div>
            ) : totalAssets !== undefined ? (
              <Text dataTestId="morpho-vault-tvl">
                {formatBigInt(totalAssets, { unit: assetDecimals, compact: true })} {assetToken.symbol}
              </Text>
            ) : (
              <Text dataTestId="morpho-vault-tvl">—</Text>
            )}
          </VStack>
        </HStack>
      </CardContent>
    </Card>
  );
};
