import { HStack } from '@/modules/layout/components/HStack';
import {
  RiskLevel,
  TOKENS,
  useSealPosition,
  useUrnAddress,
  useVault,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatPercent, math } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { SealToken } from '../constants';
import { SealPositionRewardsCard } from './SealPositionRewardsCard';
import { SealBorrowedCard, SealSealedCard } from '@/modules/ui/components/BalanceCards';
import { VStack } from '@/modules/layout/components/VStack';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { cn } from '@/lib/utils';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { SealDelegateCard } from './SealDelegateCard';
import { SealRewardCard } from './SealRewardCard';
import { useMemo } from 'react';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { formatUrnIndex } from '@jetstreamgg/sky-widgets';

const RISK_COLORS = {
  [RiskLevel.LIQUIDATION]: { text: 'text-red-400', bg: 'bg-red-400' },
  [RiskLevel.HIGH]: { text: 'text-red-400', bg: 'bg-red-400' },
  [RiskLevel.MEDIUM]: { text: 'text-orange-400', bg: 'bg-orange-400' },
  [RiskLevel.LOW]: { text: 'text-green-400', bg: 'bg-green-400' }
};

export function SealPositionOverview({
  positionIndex
}: {
  positionIndex: number;
}): React.ReactElement | null {
  const { userConfig } = useConfigContext();
  const { data, isLoading, error } = useSealPosition({ urnIndex: positionIndex });
  const { data: urnAddress, isLoading: urnAddressLoading } = useUrnAddress(BigInt(positionIndex));
  const { data: vault, isLoading: vaultLoading, error: vaultError } = useVault(urnAddress || ZERO_ADDRESS);

  if (!error && !isLoading && !data) return null;

  const riskColor = vault?.riskLevel ? RISK_COLORS[vault?.riskLevel] : undefined;

  const mkrSealed = formatBigInt(vault?.collateralAmount || 0n);
  const skySealed = useMemo(() => {
    return vault?.collateralAmount ? math.calculateConversion(TOKENS.mkr, vault?.collateralAmount || 0n) : 0n;
  }, [vault?.collateralAmount]);

  const displayToken = useMemo(() => {
    return userConfig?.sealToken === SealToken.MKR ? SealToken.MKR : SealToken.SKY;
  }, [userConfig?.sealToken]);

  return (
    <DetailSection
      title={
        <div className="flex items-center gap-4">
          <Heading className="my-4">
            <Trans>Your position {formatUrnIndex(BigInt(positionIndex))}</Trans>
          </Heading>
          {riskColor && (
            <div className="flex items-center gap-2">
              <div className={cn('h-2.5 w-2.5 rounded-full', riskColor.bg)} />
              <Text variant="small" className="text-textSecondary">
                <Trans>Risk level</Trans>
              </Text>
            </div>
          )}
        </div>
      }
    >
      <DetailSectionRow>
        <VStack className="gap-8">
          <HStack gap={2} className="scrollbar-thin w-full overflow-auto">
            <SealSealedCard
              label={displayToken === SealToken.MKR ? t`${SealToken.MKR} sealed` : t`${SealToken.SKY} sealed`}
              token={{ name: 'Maker', symbol: displayToken }}
              balance={displayToken === SealToken.MKR ? mkrSealed : skySealed}
              isLoading={vaultLoading}
              error={vaultError}
            />
            <SealBorrowedCard
              isLoading={vaultLoading}
              error={vaultError}
              balance={vault?.debtValue || 0n}
              token={{ name: 'USDS', symbol: 'USDS' }}
            />
            {data?.selectedReward && (
              <SealPositionRewardsCard rewardContractAddress={data.selectedReward as `0x${string}`} />
            )}
          </HStack>
          {(data?.selectedDelegate || data?.selectedReward) && (
            <HStack gap={2} className="w-full">
              {data?.selectedReward && <SealRewardCard selectedReward={data.selectedReward} />}
              {data?.selectedDelegate && <SealDelegateCard selectedDelegate={data.selectedDelegate} />}
            </HStack>
          )}
          <HStack gap={2} className="scrollbar-thin w-full overflow-auto">
            <StatsCard
              title={t`Collateralization ratio`}
              isLoading={urnAddressLoading || vaultLoading}
              error={urnAddressLoading ? null : vaultError}
              content={
                <Text className={cn('mt-2', riskColor ? riskColor.text : '')}>
                  {formatPercent(vault?.collateralizationRatio || 0n)}
                </Text>
              }
            />
            <StatsCard
              title={displayToken === SealToken.MKR ? t`MKR Liquidation price` : t`SKY Liquidation price`}
              isLoading={urnAddressLoading || vaultLoading}
              error={urnAddressLoading ? null : vaultError}
              content={
                <Text className="mt-2">
                  $
                  {formatBigInt(
                    displayToken === SealToken.MKR
                      ? vault?.liquidationPrice || 0n
                      : math.calculateMKRtoSKYPrice(vault?.liquidationPrice || 0n)
                  )}
                </Text>
              }
            />
            <StatsCard
              title={displayToken === SealToken.MKR ? t`Current MKR price` : t`Current SKY price`}
              isLoading={urnAddressLoading || vaultLoading}
              error={urnAddressLoading ? null : vaultError}
              content={
                <Text className="mt-2">
                  $
                  {formatBigInt(
                    displayToken === SealToken.MKR
                      ? vault?.delayedPrice || 0n
                      : math.calculateMKRtoSKYPrice(vault?.delayedPrice || 0n)
                  )}
                </Text>
              }
            />
          </HStack>
        </VStack>
      </DetailSectionRow>
    </DetailSection>
  );
}
