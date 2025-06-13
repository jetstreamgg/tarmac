import { VStack } from '@/modules/layout/components/VStack';
import { useAvailableTokenRewardContracts } from '@jetstreamgg/sky-hooks';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { useChainId } from 'wagmi';
import { LoadingErrorWrapper } from './LoadingErrorWrapper';
import { PopoverInfo } from './PopoverInfo';
import { TOKENS } from '@jetstreamgg/sky-hooks';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';
import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';

export function SavingsRate() {
  const { data, isLoading, error } = useOverallSkyData();
  const rate = formatDecimalPercentage(parseFloat(data?.skySavingsRatecRate || '0'));

  return (
    <LoadingErrorWrapper isLoading={isLoading} error={error}>
      {rate ? (
        <VStack>
          <div className="flex items-center gap-2">
            <Text variant="medium" className="text-white/80">
              With: USDS Get: USDS
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Heading className="text-[32px]"> Rate: {rate}</Heading>
            <PopoverInfo type="ssr" />
          </div>
        </VStack>
      ) : (
        <></>
      )}
    </LoadingErrorWrapper>
  );
}

export function RewardsRate({ token }: any) {
  const chainId = useChainId();

  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  // TODO: if there are multiple reward contracts with same supply token we'll need a way to choose one
  const rewardContractsWithTokenMatch = rewardContracts.filter(
    rewardContract => rewardContract.supplyToken.name === token
  );
  //TODO update this once we have multiple linked actions with the same reward supply token
  const rewardContract = rewardContractsWithTokenMatch.filter(
    rewardContract => rewardContract.rewardToken === TOKENS.sky
  )[0];
  // if no reward contract, don't show anything
  // this should be updated when we have a way to choose which reward contract to show when there are duplicates
  if (!rewardContract) {
    return <></>;
  }

  const { data, isLoading, error } = useOverallSkyData();
  const rate = formatDecimalPercentage(parseFloat(data?.usdsSkyCRate || '0')); //TODO update once we have multiple farms with linked actions

  return (
    <LoadingErrorWrapper isLoading={isLoading} error={error}>
      {rewardContract && rate ? (
        <VStack>
          <div className="flex items-center gap-2">
            <Text variant="medium" className="text-white/80">
              {rewardContract.name}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Heading className="text-[32px]">Rate {rate}</Heading>
            <PopoverInfo type="str" />
          </div>
        </VStack>
      ) : (
        <></>
      )}
    </LoadingErrorWrapper>
  );
}
