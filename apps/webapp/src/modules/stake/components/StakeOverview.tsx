import {
  useStakeHistoricData,
  useCollateralData,
  getIlkName,
  useBorrowCapacityData
} from '@jetstreamgg/sky-hooks';
import { formatDecimalPercentage, formatNumber, formatBigInt } from '@jetstreamgg/sky-utils';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { msg, t } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
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
import { getTooltipById, PopoverRateInfo, PopoverInfo, UtilizationBar } from '@jetstreamgg/sky-widgets';
import { useMemo } from 'react';
import { StakeToken } from '../constants';
import { StakingRewardRateCard } from './StakingRewardRateCard';

export function StakeOverview() {
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

  const ilkName = getIlkName(2);

  const {
    data: collateralData,
    isLoading: collateralDataLoading,
    error: collateralDataError
  } = useCollateralData(ilkName);
  const debtCeiling = collateralData?.debtCeiling ?? 0n;
  const totalDebt = collateralData?.totalDaiDebt ?? 0n;

  const { i18n } = useLingui();

  // Borrow Capacity Data
  const {
    data: borrowCapacityData,
    isLoading: isLoadingBorrowCapacity,
    error: borrowCapacityError
  } = useBorrowCapacityData();

  const borrowCapacity = borrowCapacityData?.borrowCapacity ?? 0n;
  const borrowUtilization = borrowCapacityData?.borrowUtilization ?? 0;

  const borrowUtilizationColor = '';
  const borrowTooltipContent = getTooltipById('borrow-utilization');

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Staking Engine Overview`}>
        <DetailSectionRow>
          <div className="flex w-full flex-wrap justify-between gap-3">
            <div className="min-w-[250px] flex-1">
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
            </div>
            <div className="min-w-[250px] flex-1">
              <StatsCard
                title={t`TVL`}
                isLoading={isLoading}
                error={error}
                content={<Text className="mt-2">{`$${formatNumber(tvl)}`}</Text>}
              />
            </div>
            <div className="min-w-[250px] flex-1">
              <StatsCard
                title={t`Staking positions`}
                isLoading={isLoading}
                error={error}
                content={<Text className="mt-2">{formatNumber(numberOfUrns, { maxDecimals: 0 })}</Text>}
              />
            </div>
            <div className="min-w-[250px] flex-1">
              <StatsCard
                title={
                  <HStack gap={1} className="items-center">
                    <Heading tag="h3" className="text-textSecondary text-sm font-normal leading-tight">
                      <Trans>Borrow Rate</Trans>
                    </Heading>
                    <PopoverRateInfo type="sbr" />
                  </HStack>
                }
                isLoading={isLoading}
                error={error}
                content={<Text className="mt-2">{formatDecimalPercentage(borrowRate)}</Text>}
              />
            </div>
            <div className="min-w-[250px] flex-1">
              <StakingRewardRateCard />
            </div>
            <div className="min-w-[250px] flex-1">
              <StatsCard
                title={
                  <HStack gap={1} className="items-center">
                    <Heading tag="h3" className="text-textSecondary text-sm font-normal leading-tight">
                      <Trans>Debt ceiling</Trans>
                    </Heading>
                    <PopoverRateInfo type="dtc" />
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
            </div>
            <div className="min-w-[250px] flex-1">
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
            </div>
            <div className="min-w-[250px] flex-1">
              <StatsCard
                className="h-full"
                isLoading={isLoadingBorrowCapacity}
                error={borrowCapacityError}
                title={
                  <div className="flex items-center gap-1">
                    <span>{i18n._(msg`Borrow Utilization`)}</span>
                    <PopoverInfo
                      title={i18n._(msg`${borrowTooltipContent?.title || 'Borrow Utilization'}`)}
                      description={i18n._(
                        msg`${borrowTooltipContent?.tooltip || 'The percentage of the debt ceiling currently being utilized for USDS borrowing.'}`
                      )}
                      iconClassName="text-textSecondary hover:text-white transition-colors"
                      width={14}
                      height={14}
                    />
                  </div>
                }
                content={
                  <div className="mt-2 flex items-center gap-2">
                    <Text className={borrowUtilizationColor} variant="large">
                      {borrowUtilization.toFixed(1)}%
                    </Text>
                    <UtilizationBar
                      utilizationRate={borrowUtilization}
                      isLoading={isLoadingBorrowCapacity}
                      showLabel={false}
                      barHeight="h-2"
                    />
                  </div>
                }
              />
            </div>
            <div className="min-w-[250px] flex-1">
              <StatsCard
                title={t`Available borrow capacity`}
                isLoading={isLoadingBorrowCapacity}
                error={borrowCapacityError}
                content={
                  <TokenIconWithBalance
                    className="mt-2"
                    token={{ name: 'USDS', symbol: 'USDS' }}
                    balance={formatBigInt(borrowCapacity)}
                  />
                }
              />
            </div>
          </div>
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
