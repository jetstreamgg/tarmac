import { Input } from '@widgets/components/ui/input';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { ZERO_ADDRESS, useStakeUserDelegates, useStakeUrnSelectedVoteDelegate } from '@jetstreamgg/sky-hooks';
import { useDebounce } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useState, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { DelegateCard } from './DelegateCard';
import { StakeModuleWidgetContext } from '../context/context';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Trans } from '@lingui/react/macro';
import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { Button } from '@widgets/components/ui/button';
import { getNextStep } from '../lib/utils';
// import { getAddress } from 'viem';
import { FetchingSpinner } from '@widgets/shared/components/ui/spinner/FetchingSpinner';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeFlow } from '../lib/constants';
import { Search } from '@widgets/shared/components/icons/Search';
import { NoResults } from '@widgets/shared/components/icons/NoResults';
import { Close } from '@widgets/shared/components/icons/Close';
import { t } from '@lingui/core/macro';

export const SelectDelegate = ({
  onExternalLinkClicked
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { widgetState } = useContext(WidgetContext);
  const {
    selectedDelegate,
    setSelectedDelegate,
    setIsSelectDelegateCompleted,
    currentStep,
    setCurrentStep,
    activeUrn
  } = useContext(StakeModuleWidgetContext);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const { data: delegates, isLoading } = useStakeUserDelegates({
    chainId,
    user: address || ZERO_ADDRESS,
    page: 1,
    pageSize: 100, //TODO: add pagination
    random: true,
    search: debouncedSearch,
    selectedDelegate,
    shouldSortDelegates: true
  });
  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const hasCompletedOpenFlow =
    widgetState.flow === StakeFlow.OPEN &&
    !!selectedDelegate &&
    selectedDelegate.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
  const hasCompletedManageFlow = widgetState.flow === StakeFlow.MANAGE;

  useEffect(() => {
    setIsSelectDelegateCompleted(hasCompletedOpenFlow || hasCompletedManageFlow);
  }, [hasCompletedOpenFlow, hasCompletedManageFlow]);

  const handleSkip = () => {
    // If this is an open flow, `urnSelectedVoteDelegate` would be undefined,
    // if it's a manage flow, it would default to the delegate the user previously selected
    setSelectedDelegate(urnSelectedVoteDelegate);
    // When we skip, we still set the step to complete
    setIsSelectDelegateCompleted(true);
    setCurrentStep(getNextStep(currentStep));
  };

  // Runs only once, when the component mounts
  const delegateTitle = useMemo(
    () =>
      widgetState.flow === StakeFlow.MANAGE && selectedDelegate && selectedDelegate !== ZERO_ADDRESS
        ? t`Change your delegate`
        : t`Choose your delegate`,
    []
  );

  return (
    <VStack gap={0}>
      <HStack className="items-center justify-between">
        <HStack gap={1} className="items-center">
          <Text>{delegateTitle}</Text>
          <InfoTooltip
            content={
              <>
                <Text>{delegateTitle}</Text>
                <br />
                <Text>
                  <Trans>
                    When you hold SKY tokens, you maintain the right to participate in the process of Sky
                    Ecosystem Governance voting. That means that you have the ability to contribute to the
                    community-driven, decentralized ecosystem decision-making process, which occurs through
                    onchain voting.
                  </Trans>
                </Text>
                <br />
                <Text>
                  <Trans>
                    The voting power delegation feature of the Staking Engine of the Sky Protocol enables you
                    to entrust your voting power to a delegate of your choosing, who can then vote in the Sky
                    Ecosystem Governance process on your behalf. You can choose one delegate per SKY position.
                    If you want to entrust your SKY to two delegates using the Staking Engine, you will need
                    to create two separate positions.
                  </Trans>
                </Text>
                <br />
                <Text>
                  <Trans>
                    Delegates in receipt of token voting power can never directly access any tokens delegated
                    to them, including staked tokens. Throughout the delegation process, you always own and
                    are in control of your staked tokens, and you can change your delegate at any time.
                    Staking to delegate your voting power may be a useful option for governance token holders
                    who have limited time to allocate to the process, who want to save on the cost of gas
                    involved in voting on their own, and who also want to access Staking Rewards.
                  </Trans>
                </Text>
                <br />
              </>
            }
          />
        </HStack>
        <Button variant="link" className="text-white" onClick={handleSkip}>
          <Trans>Skip</Trans>
        </Button>
      </HStack>
      <HStack gap={2} className="border-textSecondary items-center rounded-xl border p-3">
        <Search className="text-textSecondary h-4 w-4" />
        <div className="grow">
          <Input
            type="text"
            value={search}
            placeholder="Search by delegate address"
            className="placeholder:text-textSecondary h-5 text-sm leading-4 lg:text-sm lg:leading-4"
            containerClassName="border-none p-0"
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <Close
            className="text-textSecondary h-4 w-4 cursor-pointer transition-colors hover:text-white"
            onClick={() => setSearch('')}
          />
        )}
      </HStack>
      {isLoading ? (
        <div className="flex items-center justify-center pt-1">
          <FetchingSpinner message="" className="" spinnerClassName="w-10" />
        </div>
      ) : delegates?.length === 0 ? (
        <VStack gap={3} className="items-center pb-3 pt-6">
          <NoResults />
          <Text className="text-textSecondary text-center">
            <Trans>No delegates found</Trans>
          </Text>
        </VStack>
      ) : (
        <VStack className="py-3">
          {delegates?.map((delegate, index) => (
            <DelegateCard
              key={`${delegate.id}-${index}`}
              delegate={delegate}
              selectedDelegate={selectedDelegate}
              setSelectedDelegate={setSelectedDelegate}
              onExternalLinkClicked={onExternalLinkClicked}
              userAddress={address}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
};
