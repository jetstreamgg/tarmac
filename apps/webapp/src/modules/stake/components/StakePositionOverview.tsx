import { HStack } from '@/modules/layout/components/HStack';
import {
  getIlkName,
  getTokenDecimals,
  RiskLevel,
  TOKENS,
  // TOKENS,
  useStakePosition,
  useStakeUrnAddress,
  // useUrnAddress,
  useVault,
  ZERO_ADDRESS
} from '@jetstreamgg/hooks';
import { formatBigInt, formatBigIntAsCeiledAbsoluteWithSymbol } from '@jetstreamgg/utils';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { StakeToken } from '../constants';
import { StakePositionRewardsCard } from './StakePositionRewardsCard';
import { SealBorrowedCard, SealSealedCard } from '@/modules/ui/components/BalanceCards';
import { VStack } from '@/modules/layout/components/VStack';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { cn } from '@/lib/utils';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { StakeDelegateCard } from './StakeDelegateCard';
import { StakeRewardCard } from './StakeRewardCard';
// import { useMemo } from 'react';
import { formatUrnIndex } from '@jetstreamgg/widgets';
import { useChainId } from 'wagmi';
import { formatPercent } from '@jetstreamgg/utils';

const RISK_COLORS = {
  [RiskLevel.LIQUIDATION]: { text: 'text-red-400', bg: 'bg-red-400' },
  [RiskLevel.HIGH]: { text: 'text-red-400', bg: 'bg-red-400' },
  [RiskLevel.MEDIUM]: { text: 'text-orange-400', bg: 'bg-orange-400' },
  [RiskLevel.LOW]: { text: 'text-green-400', bg: 'bg-green-400' }
};

export function StakePositionOverview({
  positionIndex
}: {
  positionIndex: number;
}): React.ReactElement | null {
  const chainId = useChainId();
  const { data, isLoading, error } = useStakePosition({ urnIndex: positionIndex });
  const { data: urnAddress, isLoading: urnAddressLoading } = useStakeUrnAddress(BigInt(positionIndex));
  const {
    data: vault,
    isLoading: vaultLoading,
    error: vaultError
  } = useVault(urnAddress || ZERO_ADDRESS, getIlkName(chainId, 2));

  if (!error && !isLoading && !data) return null;

  const riskColor = vault?.riskLevel ? RISK_COLORS[vault?.riskLevel] : undefined;
  const { usds } = TOKENS;

  // const skySealed = useMemo(() => {
  //   return vault?.collateralAmount ? math.calculateConversion(TOKENS.mkr, vault?.collateralAmount || 0n) : 0n;
  // }, [vault?.collateralAmount]);

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
              label={t`${StakeToken.SKY} staked`}
              token={{ name: 'Sky', symbol: 'SKY' }}
              balance={vault?.collateralAmount || 0n}
              isLoading={vaultLoading}
              error={vaultError}
            />
            <SealBorrowedCard
              isLoading={vaultLoading}
              error={vaultError}
              balance={formatBigIntAsCeiledAbsoluteWithSymbol(
                vault?.debtValue || 0n,
                getTokenDecimals(usds, chainId)
              )}
              token={usds}
            />
            {data?.selectedReward && (
              <StakePositionRewardsCard rewardContractAddress={data.selectedReward as `0x${string}`} />
            )}
          </HStack>
          {(data?.selectedDelegate || data?.selectedReward) && (
            <HStack gap={2} className="w-full">
              {data?.selectedReward && <StakeRewardCard selectedReward={data.selectedReward} />}
              {data?.selectedDelegate && <StakeDelegateCard selectedDelegate={data.selectedDelegate} />}
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
              title={t`SKY Liquidation price`}
              isLoading={urnAddressLoading || vaultLoading}
              error={urnAddressLoading ? null : vaultError}
              content={<Text className="mt-2">${formatBigInt(vault?.liquidationPrice || 0n)}</Text>}
            />
            <StatsCard
              title={t`Current SKY price`}
              isLoading={urnAddressLoading || vaultLoading}
              error={urnAddressLoading ? null : vaultError}
              content={<Text className="mt-2">${formatBigInt(vault?.delayedPrice || 0n)}</Text>}
            />
          </HStack>
        </VStack>
      </DetailSectionRow>
    </DetailSection>
  );
}
