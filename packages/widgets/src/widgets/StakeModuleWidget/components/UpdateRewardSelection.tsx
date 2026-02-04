import { Button } from '@widgets/components/ui/button';
import {
  filterDeprecatedRewards,
  isDeprecatedStakeReward,
  useStakeRewardContracts,
  useStakeUrnSelectedRewardContract,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
import { useCallback, useContext, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@widgets/components/ui/popover';
import { useChainId } from 'wagmi';
import { ChevronDown } from 'lucide-react';
import { StakeRewardsCardCompact } from './StakeRewardsCardCompact';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { Text } from '@widgets/shared/components/ui/Typography';
import { StakeModuleWidgetContext } from '../context/context';
import { WidgetState } from '@widgets/shared/types/widgetState';
import { StakeAction, StakeStep } from '../lib/constants';
import { OnStakeUrnChange } from '..';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Token } from '@jetstreamgg/sky-hooks';
import { cn } from '@widgets/lib/utils';

export const UpdateRewardSelection = ({
  urnAddress,
  index,
  selectedVoteDelegate,
  rewardToken,
  onExternalLinkClicked,
  onStakeUrnChange
}: {
  urnAddress?: `0x${string}`;
  index: bigint;
  selectedVoteDelegate?: `0x${string}`;
  rewardToken: Token;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onStakeUrnChange?: OnStakeUrnChange;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const chainId = useChainId();
  const { setWidgetState } = useContext(WidgetContext);
  const {
    setActiveUrn,
    setSelectedDelegate,
    setSelectedRewardContract,
    setCurrentStep,
    setIsLockCompleted,
    setIsBorrowCompleted,
    setIsSelectRewardContractCompleted,
    setIsSelectDelegateCompleted
  } = useContext(StakeModuleWidgetContext);

  const { data: urnSelectedRewardContract } = useStakeUrnSelectedRewardContract({
    urn: urnAddress || ZERO_ADDRESS
  });

  const { data: rewardContracts } = useStakeRewardContracts();
  // Filter out deprecated rewards - don't use keepAddress here since
  // users changing rewards shouldn't see deprecated options
  const filteredRewardContracts = filterDeprecatedRewards(rewardContracts || [], chainId);

  // Check if current reward is deprecated - if so, user needs dropdown to change
  const currentRewardIsDeprecated =
    urnSelectedRewardContract && isDeprecatedStakeReward(urnSelectedRewardContract, chainId);

  // Show dropdown if: multiple options available OR current reward is deprecated (needs to change)
  const showDropdown = filteredRewardContracts?.length > 1 || currentRewardIsDeprecated;

  // If only one reward option AND current reward is not deprecated, show static display
  if (!showDropdown) {
    return (
      <div className="flex items-center">
        <TokenIcon token={rewardToken} width={24} className="h-6 w-6" />
        <Text className="ml-2">{rewardToken.symbol}</Text>
      </div>
    );
  }

  const handleSelectRewardContract = useCallback(
    (contractAddress: `0x${string}`) => {
      setIsOpen(false);

      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: StakeAction.MULTICALL
      }));

      setActiveUrn({ urnAddress, urnIndex: index }, onStakeUrnChange ?? (() => {}));
      setCurrentStep(StakeStep.SUMMARY);

      setSelectedRewardContract(contractAddress);
      setSelectedDelegate(selectedVoteDelegate);

      setIsLockCompleted(true);
      setIsBorrowCompleted(true);
      setIsSelectRewardContractCompleted(true);
      setIsSelectDelegateCompleted(true);
    },
    [urnAddress, index, selectedVoteDelegate]
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto w-auto p-0">
          <div className="flex items-center">
            <TokenIcon token={rewardToken} width={24} className="h-6 w-6" />
            <Text className="ml-2">{rewardToken.symbol}</Text>
            <ChevronDown className={cn('transition-transform', isOpen && 'rotate-180')} />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-container w-88 rounded-xl border-0 p-2 backdrop-blur-[50px]"
        sideOffset={8}
      >
        <div className="flex flex-col gap-2">
          <div className="px-3">
            <Text className="mb-1 text-sm">Choose your reward token</Text>
            <div className="flex items-center gap-1">
              <Text className="text-textSecondary text-xs">About Staking Reward Rates</Text>
              <PopoverRateInfo
                type="srr"
                onExternalLinkClicked={onExternalLinkClicked}
                iconClassName="text-textSecondary h-3 w-3"
              />
            </div>
          </div>
          {filteredRewardContracts?.map(({ contractAddress }) => (
            <StakeRewardsCardCompact
              key={contractAddress}
              contractAddress={contractAddress}
              urnSelectedRewardContract={urnSelectedRewardContract}
              handleCardClick={handleSelectRewardContract}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
