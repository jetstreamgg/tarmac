import { Button } from '@widgets/components/ui/button';
import { lsSkyUsdsRewardAddress, useStakeRewardContracts } from '@jetstreamgg/sky-hooks';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@widgets/components/ui/popover';
import { useChainId } from 'wagmi';
import { SaRewardsCard } from './SaRewardsCard';
import { ChevronDown } from 'lucide-react';

type UpdateRewardSelectionProps = {
  currentRewardContract?: `0x${string}`;
};

export const UpdateRewardSelection = ({ currentRewardContract }: UpdateRewardSelectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const chainId = useChainId();

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
              // onExternalLinkClicked={onExternalLinkClicked}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
