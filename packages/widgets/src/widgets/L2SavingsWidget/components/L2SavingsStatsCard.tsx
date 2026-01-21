import { useConnection, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { StatsAccordionCard } from '@widgets/shared/components/ui/card/StatsAccordionCard';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { StatsOverviewCardCore } from '@widgets/shared/components/ui/card/StatsOverviewCardCore';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import {
  sUsdsL2Address,
  useTokenBalance,
  useOverallSkyData,
  Token,
  psm3L2Address
} from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';

type L2SavingsStatsCardProps = {
  isConnectedAndEnabled?: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  convertedBalance?: {
    value: bigint;
    formatted: string;
  };
  originToken?: Token;
};

export const L2SavingsStatsCard = ({
  isConnectedAndEnabled = true,
  onExternalLinkClicked,
  convertedBalance,
  originToken
}: L2SavingsStatsCardProps) => {
  const chainId = useChainId();
  const { address } = useConnection();
  const { data: overallSkyData } = useOverallSkyData();
  const { data: sUsdsBalance } = useTokenBalance({
    address,
    token: sUsdsL2Address[chainId as keyof typeof sUsdsL2Address],
    chainId
  });
  const skySavingsRatecRate = overallSkyData?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overallSkyData.skySavingsRatecRate))
    : '0%';
  const savingsTvl = overallSkyData?.totalSavingsTvl;

  const accordionContent = (
    <HStack className="mt-5 justify-between" gap={2}>
      <MotionVStack
        className="justify-between"
        gap={2}
        variants={positionAnimations}
        data-testid="supplied-balance-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`Savings balance`}</Text>
        {isConnectedAndEnabled ? (
          <Text dataTestId="supplied-balance">
            {convertedBalance?.formatted} {originToken?.symbol}
            <span className="text-textSecondary ml-1 text-sm">
              ({formatBigInt(sUsdsBalance?.value || 0n, { compact: true, maxDecimals: 2 })} sUSDS)
            </span>
          </Text>
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
      <MotionVStack
        className="items-stretch justify-between text-right"
        gap={2}
        variants={positionAnimations}
        data-testid="savings-tvl-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`TVL`}</Text>
        {savingsTvl ? (
          <Text dataTestId="savings-tvl">{formatNumber(parseFloat(savingsTvl), { compact: true })} USDS</Text>
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
    </HStack>
  );

  return (
    <StatsOverviewCardCore
      headerLeftContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          <TokenIcon className="h-6 w-6" token={{ symbol: 'sUSDS' }} />
          <Text>Sky Savings Rate</Text>
        </MotionHStack>
      }
      headerRightContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          <Text className="text-bullish">{skySavingsRatecRate}</Text>
          <PopoverRateInfo type="ssr" onExternalLinkClicked={onExternalLinkClicked} />
        </MotionHStack>
      }
      content={
        <StatsAccordionCard
          chainId={chainId}
          address={psm3L2Address[chainId as keyof typeof psm3L2Address]}
          accordionTitle="Savings info"
          accordionContent={accordionContent}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
    />
  );
};
