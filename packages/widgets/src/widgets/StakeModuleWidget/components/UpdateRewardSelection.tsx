import { Button } from '@widgets/components/ui/button';
import { lsSkyUsdsRewardAddress, useStakeRewardContracts, ZERO_ADDRESS } from '@jetstreamgg/sky-hooks';
import { useState, useContext } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@widgets/components/ui/popover';
import { useChainId } from 'wagmi';
import { SaRewardsCard } from './SaRewardsCard';
import { ChevronDown } from 'lucide-react';
import { StakeModuleWidgetContext } from '../context/context';
import { StakeAction, StakeStep } from '../lib/constants';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetState } from '@widgets/shared/types/widgetState';

type UpdateRewardSelectionProps = {
  currentRewardContract?: `0x${string}`;
  currentDelegate?: `0x${string}`;
  urnAddress?: `0x${string}`;
  urnIndex: bigint;
  onStakeUrnChange?: (
    urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined
  ) => void;
  onWidgetStateChange?: (state: any) => void;
};

export const UpdateRewardSelection = ({
  currentRewardContract,
  currentDelegate,
  urnAddress,
  urnIndex,
  onStakeUrnChange,
  onWidgetStateChange
}: UpdateRewardSelectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const chainId = useChainId();
  const { setWidgetState, widgetState, txStatus } = useContext(WidgetContext);
  const {
    setSelectedRewardContract,
    setSelectedDelegate,
    currentStep,
    setCurrentStep,
    setIsSelectRewardContractCompleted,
    setActiveUrn,
    setIsLockCompleted,
    setIsBorrowCompleted,
    setIsSelectDelegateCompleted,
    setSkyToLock,
    setSkyToFree,
    setUsdsToBorrow,
    setUsdsToWipe,
    setWantsToDelegate
  } = useContext(StakeModuleWidgetContext);

  const { data: rewardContracts } = useStakeRewardContracts();
  const filteredRewardContracts = rewardContracts?.filter(({ contractAddress }) => {
    const usdsRewardAddress = lsSkyUsdsRewardAddress[chainId as keyof typeof lsSkyUsdsRewardAddress];

    // Filter out USDS reward
    if (contractAddress.toLowerCase() === usdsRewardAddress?.toLowerCase()) {
      return false;
    }

    // Filter out the currently selected reward
    if (currentRewardContract && contractAddress.toLowerCase() === currentRewardContract.toLowerCase()) {
      return false;
    }

    return true;
  });

  const handleSelectReward = (rewardContract: `0x${string}`) => {
    // Update URL state with the urnIndex to sync with widget state
    onWidgetStateChange?.({
      widgetState,
      txStatus,
      urnIndex: Number(urnIndex)
    });

    // Set the active urn to ensure we're managing the correct position
    setActiveUrn({ urnAddress, urnIndex }, onStakeUrnChange ?? (() => {}));

    // Update widget state action to MULTICALL to enter the manage flow
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: StakeAction.MULTICALL
    }));

    // Reset amounts since we're only changing the reward
    setSkyToLock(0n);
    setSkyToFree(0n);
    setUsdsToBorrow(0n);
    setUsdsToWipe(0n);

    // Mark lock/borrow steps as complete since we're not changing them
    setIsLockCompleted(true);
    setIsBorrowCompleted(true);

    // Set the current delegate and mark as complete since we're not changing it
    setSelectedDelegate(currentDelegate);
    // Set wantsToDelegate based on whether user has a delegate
    setWantsToDelegate(currentDelegate !== undefined && currentDelegate !== ZERO_ADDRESS);
    setIsSelectDelegateCompleted(true);

    // Update the selected reward contract to the new one
    setSelectedRewardContract(rewardContract);
    setIsSelectRewardContractCompleted(true);

    // Navigate to the summary step
    setCurrentStep(StakeStep.SUMMARY);

    // Close the popover
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-6 w-6 p-0">
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-container w-80 rounded-xl border-0 p-2 backdrop-blur-[50px]"
        sideOffset={8}
      >
        <div className="flex flex-col gap-2">
          {filteredRewardContracts?.map(({ contractAddress }) => (
            <SaRewardsCard
              key={contractAddress}
              contractAddress={contractAddress}
              selectedRewardContract={undefined}
              setSelectedRewardContract={_prev => {
                handleSelectReward(contractAddress);
                return contractAddress;
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
