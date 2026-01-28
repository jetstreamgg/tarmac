import { formatBigInt } from '@jetstreamgg/sky-utils';
import {
  useMorphoVaultData,
  Token,
  getTokenDecimals,
  useMorphoVaultCombinedData
} from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChainId } from 'wagmi';
import { MorphoRateBreakdownPopover, MorphoVaultBadge } from '@jetstreamgg/sky-widgets';
import { Trans } from '@lingui/react/macro';

type MorphoVaultStatsCardProps = {
  vaultAddress: Record<number, `0x${string}`>;
  vaultName: string;
  assetToken: Token;
  onClick?: () => void;
  disabled?: boolean;
};

export const MorphoVaultStatsCard = ({
  vaultAddress,
  vaultName,
  assetToken,
  onClick,
  disabled = false
}: MorphoVaultStatsCardProps) => {
  const chainId = useChainId();
  const assetDecimals = getTokenDecimals(assetToken, chainId);

  const currentVaultAddress = vaultAddress[chainId];

  // Hooks for Morpho vault data
  const { data: vaultData, isLoading: vaultLoading } = useMorphoVaultData({
    vaultAddress: currentVaultAddress
  });

  const { data: combinedData, isLoading: combinedDataLoading } = useMorphoVaultCombinedData({
    vaultAddress: currentVaultAddress
  });

  // Data handling
  const totalAssets = vaultData?.totalAssets || 0n;
  const liquidity = combinedData?.market.markets[0]?.liquidity ?? 0n;

  if (!currentVaultAddress) {
    return null;
  }

  return (
    <Card
      className={`from-card to-card h-full bg-radial-(--gradient-position) transition-[background-color,background-image,opacity] lg:p-5 ${onClick && !disabled ? 'hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer' : ''} ${disabled ? 'opacity-50' : ''}`}
      onClick={disabled ? undefined : onClick}
      data-testid="morpho-vault-stats-card"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        {/* Left side - Title */}
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-6 w-6" token={{ symbol: assetToken.symbol }} />
          <Text>{vaultName}</Text>
          <MorphoVaultBadge />
        </HStack>

        {/* Right side - Rate */}
        <MorphoRateBreakdownPopover vaultAddress={currentVaultAddress} tooltipIconClassName="w-3 h-3" />
      </CardHeader>

      <CardContent className="mt-5 p-0">
        <HStack className="justify-between" gap={2}>
          {/* Liquidity */}
          <VStack className="items-stretch justify-between" gap={2} data-testid="liquidity-container">
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>Liquidity</Trans>
            </Text>
            {combinedDataLoading ? (
              <Skeleton className="bg-textSecondary h-6 w-21" />
            ) : (
              <Text dataTestId="morpho-vault-tvl">
                {formatBigInt(liquidity, { unit: assetDecimals, compact: true })} {assetToken.symbol}
              </Text>
            )}
          </VStack>
          {/* TVL */}
          <VStack className="items-stretch justify-between text-right" gap={2} data-testid="tvl-container">
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>TVL</Trans>
            </Text>
            {vaultLoading ? (
              <div className="flex justify-end">
                <Skeleton className="bg-textSecondary h-6 w-30" />
              </div>
            ) : (
              <Text dataTestId="morpho-vault-tvl">
                {formatBigInt(totalAssets, { unit: assetDecimals, compact: true })} {assetToken.symbol}
              </Text>
            )}
          </VStack>
        </HStack>
      </CardContent>
    </Card>
  );
};
