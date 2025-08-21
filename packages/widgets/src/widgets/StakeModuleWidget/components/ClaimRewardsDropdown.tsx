import { Button } from '@widgets/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@widgets/components/ui/popover';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { Text } from '@widgets/shared/components/ui/Typography';
import { useRewardContractsToClaim } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { TxStatus } from '@widgets/shared/constants';
import { WidgetState } from '@widgets/shared/types/widgetState';
import { StakeAction, StakeScreen } from '../lib/constants';
import { StakeModuleWidgetContext } from '../context/context';
import { ChevronDown } from 'lucide-react';
import { cn } from '@widgets/lib/utils';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { ClaimRewardsButton } from './ClaimRewardsButton';

export function ClaimRewardsDropdown({
  stakeRewardContracts,
  urnAddress,
  index,
  claimPrepared,
  claimExecute
}: {
  stakeRewardContracts: {
    contractAddress: `0x${string}`;
  }[];
  urnAddress: `0x${string}`;
  index: bigint;
  claimPrepared: boolean;
  claimExecute: () => void;
}) {
  const { setTxStatus, setExternalLink, setShowStepIndicator, setWidgetState } = useContext(WidgetContext);
  const { indexToClaim, setIndexToClaim, rewardContractToClaim, setRewardContractToClaim } =
    useContext(StakeModuleWidgetContext);

  const chainId = useChainId();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<`0x${string}` | null>(null);

  const { data: rewardContractsToClaim } = useRewardContractsToClaim({
    rewardContractAddresses: stakeRewardContracts.map(({ contractAddress }) => contractAddress),
    userAddress: urnAddress,
    chainId
  });

  const selectedRewardToClaim = useMemo(() => {
    return rewardContractsToClaim?.find(({ contractAddress }) => contractAddress === selectedContract);
  }, [rewardContractsToClaim, selectedContract]);

  const handleClaimClick = () => {
    if (selectedContract) {
      setIndexToClaim(index);
      setRewardContractToClaim(selectedContract);
    }
  };

  const handleOptionSelect = (option: `0x${string}`) => {
    setSelectedContract(option);
    setIsOpen(false);
  };

  useEffect(() => {
    if (
      indexToClaim === index &&
      selectedContract &&
      rewardContractToClaim === selectedContract &&
      claimPrepared
    ) {
      setShowStepIndicator(false);
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: StakeAction.CLAIM,
        screen: StakeScreen.TRANSACTION
      }));
      setTxStatus(TxStatus.INITIALIZED);
      setExternalLink(undefined);
      claimExecute();
    }
  }, [indexToClaim, index, rewardContractToClaim, selectedContract, claimPrepared]);

  const isProcessing =
    indexToClaim === index && selectedContract && rewardContractToClaim === selectedContract;
  const isDisabled = !!rewardContractToClaim && indexToClaim !== undefined;

  if (!rewardContractsToClaim || rewardContractsToClaim.length === 0) return null;
  if (rewardContractsToClaim.length === 1)
    return (
      <ClaimRewardsButton
        rewardContract={rewardContractsToClaim[0].contractAddress}
        urnAddress={urnAddress}
        index={index}
        claimPrepared={claimPrepared}
        claimExecute={claimExecute}
      />
    );

  return (
    <div className="flex">
      <Button
        variant="secondary"
        onClick={handleClaimClick}
        disabled={isDisabled || !selectedRewardToClaim}
        className="flex-1 rounded-r-none border-r-0"
      >
        <Text>
          {isProcessing
            ? 'Preparing your claim transaction...'
            : selectedRewardToClaim
              ? `Claim ${formatBigInt(selectedRewardToClaim.claimBalance)} ${selectedRewardToClaim.rewardSymbol}`
              : 'Select reward to claim'}
        </Text>
      </Button>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            disabled={isDisabled}
            className="border-l-textSecondary rounded-l-none border-l px-3"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="bg-container w-auto rounded-xl border-0 p-2 backdrop-blur-[50px]"
          align="end"
          sideOffset={8}
        >
          <VStack className="space-y-1">
            {rewardContractsToClaim.map(({ contractAddress, claimBalance, rewardSymbol }) => (
              <Button
                key={contractAddress}
                variant={null}
                onClick={() => handleOptionSelect(contractAddress)}
                className={cn(
                  'text-text flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm bg-blend-overlay transition',
                  selectedContract === contractAddress ? 'bg-surface' : 'bg-transparent hover:bg-[#FFFFFF0D]'
                )}
              >
                <Text>{`Claim ${formatBigInt(claimBalance)} ${rewardSymbol}`}</Text>
              </Button>
            ))}
          </VStack>
        </PopoverContent>
      </Popover>
    </div>
  );
}
