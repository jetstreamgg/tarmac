import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Token, type MorphoVaultRateData } from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MorphoRateBreakdownPopover, MorphoVaultBadge } from '@jetstreamgg/sky-widgets';
import { Trans } from '@lingui/react/macro';

type MorphoVaultStatsCardProps = {
  vaultAddress: `0x${string}`;
  vaultName: string;
  assetToken: Token;
  data?: MorphoVaultRateData;
  isLoading: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

export const MorphoVaultStatsCard = ({
  vaultAddress,
  vaultName,
  assetToken,
  data,
  isLoading,
  onClick,
  disabled = false
}: MorphoVaultStatsCardProps) => {
  const assetDecimals = data?.assetDecimals ?? 18;

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
        <MorphoRateBreakdownPopover
          vaultAddress={vaultAddress}
          tooltipIconClassName="w-3 h-3"
          rateData={data}
          isLoading={isLoading}
        />
      </CardHeader>

      <CardContent className="mt-5 p-0">
        <HStack className="justify-between" gap={2}>
          {/* Liquidity */}
          <VStack className="items-stretch justify-between" gap={2} data-testid="liquidity-container">
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>Liquidity</Trans>
            </Text>
            {isLoading ? (
              <Skeleton className="bg-textSecondary h-6 w-21" />
            ) : data?.liquidity !== undefined ? (
              <Text dataTestId="morpho-vault-tvl">
                {formatBigInt(data.liquidity, { unit: assetDecimals, compact: true })} {assetToken.symbol}
              </Text>
            ) : (
              <Text dataTestId="morpho-vault-tvl">—</Text>
            )}
          </VStack>
          {/* TVL */}
          <VStack className="items-stretch justify-between text-right" gap={2} data-testid="tvl-container">
            <Text className="text-textSecondary text-sm leading-4">
              <Trans>TVL</Trans>
            </Text>
            {isLoading ? (
              <div className="flex justify-end">
                <Skeleton className="bg-textSecondary h-6 w-30" />
              </div>
            ) : data?.totalAssets !== undefined ? (
              <Text dataTestId="morpho-vault-tvl">
                {formatBigInt(data.totalAssets, { unit: assetDecimals, compact: true })} {assetToken.symbol}
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
