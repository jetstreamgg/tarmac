import { Button } from '@widgets/components/ui/button';
import {
  ZERO_ADDRESS,
  useStakeUserDelegates,
  useStakeUrnSelectedVoteDelegate,
  useDelegateName,
  useDelegateOwner
} from '@jetstreamgg/sky-hooks';
import { useCallback, useContext, useState } from 'react';
import { Popover, PopoverContent, PopoverPortal, PopoverTrigger } from '@widgets/components/ui/popover';
import { useAccount, useChainId } from 'wagmi';
import { ChevronDown } from 'lucide-react';
import { StakeDelegateCardCompact } from './StakeDelegateCardCompact';
import { Text } from '@widgets/shared/components/ui/Typography';
import { StakeModuleWidgetContext } from '../context/context';
import { WidgetState } from '@widgets/shared/types/widgetState';
import { StakeAction, StakeStep } from '../lib/constants';
import { OnStakeUrnChange } from '..';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { JazziconComponent } from './Jazzicon';
import { cn } from '@widgets/lib/utils';
import { useDebounce } from '@jetstreamgg/sky-utils';
import { Search } from '@widgets/shared/components/icons/Search';
import { Input } from '@widgets/components/ui/input';
import { Close } from '@widgets/shared/components/icons/Close';

export const UpdateDelegateSelection = ({
  urnAddress,
  index,
  selectedRewardContract,
  selectedVoteDelegate,
  onStakeUrnChange
}: {
  urnAddress?: `0x${string}`;
  index: bigint;
  selectedRewardContract?: `0x${string}`;
  selectedVoteDelegate?: `0x${string}`;
  onStakeUrnChange?: OnStakeUrnChange;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { address } = useAccount();
  const chainId = useChainId();
  const { setWidgetState } = useContext(WidgetContext);
  const {
    setActiveUrn,
    setWantsToDelegate,
    setSelectedDelegate,
    setSelectedRewardContract,
    setCurrentStep,
    setIsLockCompleted,
    setIsBorrowCompleted,
    setIsSelectRewardContractCompleted,
    setIsSelectDelegateCompleted
  } = useContext(StakeModuleWidgetContext);

  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: urnAddress || ZERO_ADDRESS
  });

  const { data: selectedDelegateName } = useDelegateName(selectedVoteDelegate);
  const { data: selectedDelegateOwner } = useDelegateOwner(selectedVoteDelegate);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data: delegates } = useStakeUserDelegates({
    chainId,
    user: address || ZERO_ADDRESS,
    page: 1,
    pageSize: 100,
    random: true,
    search: debouncedSearch,
    shouldSortDelegates: true
  });

  const handleSelectDelegate = useCallback(
    (delegateAddress: `0x${string}`) => {
      setIsOpen(false);

      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: StakeAction.MULTICALL
      }));

      setActiveUrn({ urnAddress, urnIndex: index }, onStakeUrnChange ?? (() => {}));
      setCurrentStep(StakeStep.SUMMARY);

      setWantsToDelegate(true);
      setSelectedDelegate(delegateAddress);
      setSelectedRewardContract(selectedRewardContract);

      setIsLockCompleted(true);
      setIsBorrowCompleted(true);
      setIsSelectRewardContractCompleted(true);
      setIsSelectDelegateCompleted(true);
    },
    [urnAddress, index, selectedRewardContract, onStakeUrnChange]
  );

  const hasDelegateSelected = selectedVoteDelegate && selectedVoteDelegate !== ZERO_ADDRESS;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-6 w-auto p-0">
          <div className="flex items-start">
            <div className="flex gap-2">
              <JazziconComponent address={selectedDelegateOwner} />
              <Text>{hasDelegateSelected ? selectedDelegateName : 'No delegate'}</Text>
            </div>
            <ChevronDown className={cn('transition-transform', isOpen && 'rotate-180')} />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          className="bg-container w-88 rounded-xl border-0 p-2 backdrop-blur-[50px]"
          sideOffset={4}
          avoidCollisions={true}
        >
          <div className="flex flex-col gap-2">
            <div className="px-3">
              <Text className="mb-1 text-sm">Choose your delegate</Text>
              <div className="border-textSecondary flex items-center gap-2 rounded-xl border p-2">
                <Search className="text-textSecondary h-4 w-4" />
                <div className="grow">
                  <Input
                    type="text"
                    value={search}
                    placeholder="Search by delegate address"
                    className="placeholder:text-textSecondary h-4 text-sm leading-4 lg:text-sm lg:leading-4"
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
              </div>
            </div>
            <div className="scrollbar-thin-always flex max-h-96 flex-col gap-2 overflow-y-scroll">
              {delegates?.map(delegate => (
                <StakeDelegateCardCompact
                  key={delegate.id}
                  delegate={delegate}
                  urnSelectedVoteDelegate={urnSelectedVoteDelegate}
                  handleCardClick={handleSelectDelegate}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
};
