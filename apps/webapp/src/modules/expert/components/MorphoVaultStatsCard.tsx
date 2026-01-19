import { formatBigInt } from '@jetstreamgg/sky-utils';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useMorphoVaultData, useMorphoVaultRate, Token, getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChainId } from 'wagmi';

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
  const { i18n } = useLingui();
  const chainId = useChainId();
  const assetDecimals = getTokenDecimals(assetToken, chainId);

  const currentVaultAddress = vaultAddress[chainId];

  // Hooks for Morpho vault data
  const { data: vaultData, isLoading: vaultLoading } = useMorphoVaultData({
    vaultAddress: currentVaultAddress
  });
  const { data: rateData, isLoading: rateLoading } = useMorphoVaultRate({
    vaultAddress: currentVaultAddress
  });

  // Data handling
  const formattedRate = rateData?.formattedRate || '0.00%';
  const totalAssets = vaultData?.totalAssets || 0n;

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
        </HStack>

        {/* Right side - Rate */}
        <HStack className="items-center" gap={2}>
          {rateLoading ? (
            <Skeleton className="bg-textSecondary h-5 w-16" />
          ) : (
            <Text className="text-primary">
              <Text tag="span" className="text-bullish ml-1">
                {formattedRate}
              </Text>
            </Text>
          )}
        </HStack>
      </CardHeader>

      <CardContent className="mt-5 p-0">
        <HStack className="justify-end" gap={2}>
          {/* TVL */}
          <VStack className="items-stretch justify-between text-right" gap={2} data-testid="tvl-container">
            <Text className="text-textSecondary text-sm leading-4">{i18n._(msg`TVL`)}</Text>
            {vaultLoading ? (
              <div className="flex justify-end">
                <Skeleton className="bg-textSecondary h-6 w-10" />
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
