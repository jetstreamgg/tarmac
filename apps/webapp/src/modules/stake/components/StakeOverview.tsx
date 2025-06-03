import { useStakeHistoricData, useCollateralData, getIlkName } from '@jetstreamgg/hooks';
import { formatDecimalPercentage, formatNumber, formatBigInt } from '@jetstreamgg/utils';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { HStack } from '@/modules/layout/components/HStack';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { AboutStakeModule } from '@/modules/ui/components/AboutStakeModule';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { StakeHistory } from './StakeHistory';
import { StakeRewardsOverview } from './StakeRewardsOverview';
import { StakeFaq } from './StakeFaq';
import { StakeChart } from './StakeChart';
import { PopoverInfo } from '@/modules/ui/components/PopoverInfo';
import { useMemo } from 'react';
import { StakeToken } from '../constants';
import { useChainId } from 'wagmi';

export function StakeOverview() {
  const chainId = useChainId();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { data, isLoading, error } = useStakeHistoricData();
  const mostRecentData = data?.sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  )[0];

  const skySealed = useMemo(() => {
    return formatNumber(mostRecentData?.totalSky || 0);
  }, [mostRecentData?.totalSky]);

  const borrowRate = mostRecentData?.borrowRate ?? 0;
  const tvl = mostRecentData?.tvl ?? 0;
  const numberOfUrns = mostRecentData?.numberOfUrns ?? 0;

  const ilkName = getIlkName(chainId, 2);

  const {
    data: collateralData,
    isLoading: collateralDataLoading,
    error: collateralDataError
  } = useCollateralData(ilkName);
  const debtCeiling = collateralData?.debtCeiling ?? 0n;
  const totalDebt = collateralData?.totalDaiDebt ?? 0n;

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Staking Engine Overview`}>
        <DetailSectionRow>
          <HStack gap={2} className="scrollbar-thin w-full overflow-auto">
            <StatsCard
              title={t`Total SKY staked`}
              isLoading={isLoading}
              error={error}
              content={
                <TokenIconWithBalance
                  className="mt-2"
                  token={{ name: StakeToken.SKY, symbol: StakeToken.SKY }}
                  balance={skySealed}
                />
              }
            />
            <StatsCard
              title={t`Total USDS borrowed`}
              isLoading={collateralDataLoading}
              error={collateralDataError}
              content={
                <TokenIconWithBalance
                  className="mt-2"
                  token={{ name: 'USDS', symbol: 'USDS' }}
                  balance={formatBigInt(totalDebt)}
                />
              }
            />
            <StatsCard
              title={
                <HStack gap={1} className="items-center">
                  <Heading tag="h3" className="text-textSecondary text-sm font-normal leading-tight">
                    <Trans>Debt ceiling</Trans>
                  </Heading>
                  <PopoverInfo type="dtc" />
                </HStack>
              }
              isLoading={collateralDataLoading}
              error={collateralDataError}
              content={
                <TokenIconWithBalance
                  className="mt-2"
                  token={{ name: 'USDS', symbol: 'USDS' }}
                  balance={formatBigInt(debtCeiling)}
                />
              }
            />
          </HStack>
        </DetailSectionRow>
        <DetailSectionRow>
          <HStack gap={2} className="scrollbar-thin w-full overflow-auto">
            <StatsCard
              title={
                <HStack gap={1} className="items-center">
                  <Heading tag="h3" className="text-textSecondary text-sm font-normal leading-tight">
                    <Trans>Borrow Rate</Trans>
                  </Heading>
                  <PopoverInfo type="sbr" />
                </HStack>
              }
              isLoading={isLoading}
              error={error}
              content={<Text className="mt-2">{formatDecimalPercentage(borrowRate)}</Text>}
            />
            <StatsCard
              title={t`TVL`}
              isLoading={isLoading}
              error={error}
              content={<Text className="mt-2">{`$${formatNumber(tvl)}`}</Text>}
            />
            <StatsCard
              title={t`Staking positions`}
              isLoading={isLoading}
              error={error}
              content={<Text className="mt-2">{numberOfUrns}</Text>}
            />
          </HStack>
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Staking Rewards overview`}>
        <DetailSectionRow>
          <StakeRewardsOverview />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your Staking Engine transaction history`}>
          <DetailSectionRow>
            <StakeHistory />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Metrics`}>
        <DetailSectionRow>
          <StakeChart />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Staking Rewards`}>
        <DetailSectionRow>
          <AboutStakeModule />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <StakeFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
