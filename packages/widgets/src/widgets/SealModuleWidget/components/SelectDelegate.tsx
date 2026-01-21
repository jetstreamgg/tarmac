import { Input } from '@widgets/components/ui/input';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { ZERO_ADDRESS, useSaUserDelegates, useUrnSelectedVoteDelegate } from '@jetstreamgg/sky-hooks';
import { useDebounce } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useState } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { DelegateCard } from './DelegateCard';
import { SealModuleWidgetContext } from '../context/context';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { Button } from '@widgets/components/ui/button';
import { getNextStep } from '../lib/utils';
// import { getAddress } from 'viem';
import { FetchingSpinner } from '@widgets/shared/components/ui/spinner/FetchingSpinner';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { SealFlow } from '../lib/constants';
import { Search } from '@widgets/shared/components/icons/Search';
import { NoResults } from '@widgets/shared/components/icons/NoResults';
import { Close } from '@widgets/shared/components/icons/Close';
import { formatEther } from 'viem';

export const SelectDelegate = ({
  onExternalLinkClicked
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { address } = useConnection();
  const chainId = useChainId();
  const { widgetState } = useContext(WidgetContext);
  const {
    selectedDelegate,
    setSelectedDelegate,
    setIsSelectDelegateCompleted,
    currentStep,
    setCurrentStep,
    activeUrn
  } = useContext(SealModuleWidgetContext);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const { data: delegates, isLoading } = useSaUserDelegates({
    chainId,
    user: address || ZERO_ADDRESS,
    page: 1,
    pageSize: 100, //TODO: add pagination
    random: true,
    search: debouncedSearch
  });
  const { data: urnSelectedVoteDelegate } = useUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const hasCompletedOpenFlow =
    widgetState.flow === SealFlow.OPEN &&
    !!selectedDelegate &&
    selectedDelegate.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
  const hasCompletedManageFlow = widgetState.flow === SealFlow.MANAGE;

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

  // TODO: How to handle pagination? Pending design
  //    Infinite scroll
  //    Load more button
  //    Pagination component

  return (
    <VStack gap={0}>
      <HStack className="items-center justify-between">
        <HStack gap={1} className="items-center">
          <Text>
            <Trans>Choose your delegate</Trans>
          </Text>
          <InfoTooltip content={t`You can optionally select a delegate or skip this step`} />
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
        <VStack gap={3} className="items-center pt-6 pb-3">
          <NoResults />
          <Text className="text-textSecondary text-center">
            <Trans>No delegates found</Trans>
          </Text>
        </VStack>
      ) : (
        <VStack className="py-3">
          {delegates
            // Sort the user's selected delegate first
            // .sort((a, b) =>
            //   getAddress(a.id) === (selectedDelegate ? getAddress(selectedDelegate) : '')
            //     ? -1
            //     : getAddress(b.id) === (selectedDelegate ? getAddress(selectedDelegate) : '')
            //       ? 1
            //       : 0
            // )
            // Sort delegates by total delegated MKR descending
            ?.map(delegate => ({
              ...delegate,
              totalDelegatedEther: delegate.totalDelegated ? Number(formatEther(delegate.totalDelegated)) : 0
            }))
            .sort((a, b) => b.totalDelegatedEther - a.totalDelegatedEther)
            .map((delegate, index) => (
              <DelegateCard
                key={`${delegate.id}-${index}`}
                delegate={delegate}
                selectedDelegate={selectedDelegate}
                setSelectedDelegate={setSelectedDelegate}
                onExternalLinkClicked={onExternalLinkClicked}
              />
            ))}
        </VStack>
      )}
    </VStack>
  );
};
