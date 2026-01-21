import { Button } from '@widgets/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@widgets/components/ui/popover';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { Text } from '@widgets/shared/components/ui/Typography';
import { useRewardContractsToClaim } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useCallback, useContext, useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { WidgetState } from '@widgets/shared/types/widgetState';
import { StakeAction, StakeStep } from '../lib/constants';
import { StakeModuleWidgetContext } from '../context/context';
import { ChevronDown } from 'lucide-react';
import { cn } from '@widgets/lib/utils';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { ClaimRewardsButton } from './ClaimRewardsButton';
import { OnStakeUrnChange } from '..';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Rewards } from '@widgets/shared/components/icons/Rewards';
import { RewardWithTokenIcon } from './RewardWithTokenIcon';

export function ClaimRewardsDropdown({
  stakeRewardContracts,
  urnAddress,
  index,
  selectedReward,
  selectedVoteDelegate,
  onStakeUrnChange
}: {
  stakeRewardContracts: {
    contractAddress: `0x${string}`;
  }[];
  urnAddress: `0x${string}`;
  index: bigint;
  selectedReward: `0x${string}` | undefined;
  selectedVoteDelegate: `0x${string}` | undefined;
  onStakeUrnChange?: OnStakeUrnChange;
}) {
  const { setWidgetState } = useContext(WidgetContext);
  const {
    indexToClaim,
    rewardContractsToClaim,
    setRewardContractsToClaim,
    setActiveUrn,
    setCurrentStep,
    setSelectedRewardContract,
    setSelectedDelegate,
    setIsLockCompleted,
    setIsBorrowCompleted,
    setIsSelectRewardContractCompleted,
    setIsSelectDelegateCompleted,
    setRestakeSkyRewards
  } = useContext(StakeModuleWidgetContext);

  const chainId = useChainId();
  const [isOpen, setIsOpen] = useState(false);

  const { data: claimableRewardContracts } = useRewardContractsToClaim({
    rewardContractAddresses: stakeRewardContracts.map(({ contractAddress }) => contractAddress),
    addresses: urnAddress,
    chainId
  });

  const handleSelectOption = useCallback(
    ({ contracts, restakeSky = false }: { contracts: `0x${string}`[] | undefined; restakeSky?: boolean }) => {
      setIsOpen(false);

      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: StakeAction.MULTICALL
      }));

      setActiveUrn({ urnAddress, urnIndex: index }, onStakeUrnChange ?? (() => {}));
      setCurrentStep(StakeStep.SUMMARY);

      setSelectedRewardContract(selectedReward);
      setSelectedDelegate(selectedVoteDelegate);
      setRewardContractsToClaim(contracts);
      setRestakeSkyRewards(restakeSky);

      setIsLockCompleted(true);
      setIsBorrowCompleted(true);
      setIsSelectRewardContractCompleted(true);
      setIsSelectDelegateCompleted(true);
    },
    [
      urnAddress,
      index,
      selectedVoteDelegate,
      selectedReward,
      setWidgetState,
      setActiveUrn,
      onStakeUrnChange,
      setCurrentStep,
      setSelectedRewardContract,
      setSelectedDelegate,
      setRewardContractsToClaim,
      setRestakeSkyRewards,
      setIsLockCompleted,
      setIsBorrowCompleted,
      setIsSelectRewardContractCompleted,
      setIsSelectDelegateCompleted
    ]
  );

  const sortedClaimableRewardContracts = useMemo(() => {
    if (!claimableRewardContracts) return [];

    return [...claimableRewardContracts].sort((a, b) => {
      const aIsSky = a.rewardSymbol?.toUpperCase?.() === 'SKY';
      const bIsSky = b.rewardSymbol?.toUpperCase?.() === 'SKY';

      if (aIsSky && !bIsSky) return -1;
      if (!aIsSky && bIsSky) return 1;
      return 0;
    });
  }, [claimableRewardContracts]);

  const claimableRewardContractAddresses = useMemo(
    () => sortedClaimableRewardContracts.map(({ contractAddress }) => contractAddress),
    [sortedClaimableRewardContracts]
  );

  const skyReward = useMemo(
    () => sortedClaimableRewardContracts.find(({ rewardSymbol }) => rewardSymbol?.toUpperCase?.() === 'SKY'),
    [sortedClaimableRewardContracts]
  );
  const skyContractAddress = skyReward?.contractAddress;
  const hasSkyReward = !!skyReward;
  const hasMultipleRewards = sortedClaimableRewardContracts.length > 1;
  const skySymbol = skyReward?.rewardSymbol?.toUpperCase?.() ?? 'SKY';

  const isDisabled = !!rewardContractsToClaim?.length && indexToClaim !== undefined;

  if (!claimableRewardContracts || claimableRewardContracts.length === 0) return null;
  if (claimableRewardContracts.length === 1)
    return (
      <ClaimRewardsButton
        rewardContract={claimableRewardContracts[0].contractAddress}
        urnAddress={urnAddress}
        handleSelectOption={handleSelectOption}
      />
    );

  return (
    <div className="flex h-14 items-center justify-between rounded-2xl bg-linear-to-r from-[#403570] to-[#4B337B] px-5 py-4">
      <div className="flex items-center">
        <Text variant="medium" className="text-[#f2dcfc]">
          Select reward
        </Text>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" disabled={isDisabled} className="h-fit px-2">
              <Text variant="medium" className="text-text">
                to claim
              </Text>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="bg-container w-auto rounded-xl border-0 p-2 backdrop-blur-[50px]"
            align="end"
            sideOffset={8}
          >
            <Text className="mb-1.5 px-2" variant="small">
              Accrued Staking rewards
            </Text>
            <VStack className="space-y-2.5">
              {hasSkyReward && hasMultipleRewards && skyContractAddress && (
                <Button
                  variant={null}
                  onClick={() =>
                    handleSelectOption({
                      contracts: claimableRewardContractAddresses.length
                        ? claimableRewardContractAddresses
                        : undefined,
                      restakeSky: true
                    })
                  }
                  className={cn(
                    'text-text flex h-13.5 w-full items-center justify-start gap-2.5 rounded-lg px-4 py-3 text-sm transition-colors',
                    'from-card to-card hover:from-primary-start hover:to-primary-end bg-radial-(--gradient-position)'
                  )}
                >
                  <RewardWithTokenIcon token={{ symbol: skySymbol }} className="h-7 w-7" />
                  <Text variant="medium">Claim all &amp; Restake {skySymbol}</Text>
                </Button>
              )}
              {hasSkyReward && hasMultipleRewards && skyContractAddress && (
                <Button
                  variant={null}
                  onClick={() =>
                    handleSelectOption({
                      contracts: [skyContractAddress],
                      restakeSky: true
                    })
                  }
                  className={cn(
                    'text-text flex h-13.5 w-full items-center justify-start gap-2.5 rounded-lg px-4 py-3 text-sm transition-colors',
                    'from-card to-card hover:from-primary-start hover:to-primary-end bg-radial-(--gradient-position)'
                  )}
                >
                  <TokenIcon token={{ symbol: skySymbol }} className="h-7 w-7" />
                  <Text variant="medium">
                    Claim {formatBigInt(skyReward?.claimBalance ?? 0n)} {skySymbol} &amp; Restake
                  </Text>
                </Button>
              )}
              {sortedClaimableRewardContracts.map(({ contractAddress, claimBalance, rewardSymbol }) => (
                <Button
                  key={contractAddress}
                  variant={null}
                  onClick={() => handleSelectOption({ contracts: [contractAddress] })}
                  className={cn(
                    'text-text flex h-13.5 w-full items-center justify-start gap-2.5 rounded-lg px-4 py-3 text-sm transition-colors',
                    'from-card to-card hover:from-primary-start hover:to-primary-end bg-radial-(--gradient-position)'
                  )}
                >
                  <TokenIcon token={{ symbol: rewardSymbol }} className="h-7 w-7" />
                  <Text variant="medium">{`Claim only ${formatBigInt(claimBalance)} ${rewardSymbol}`}</Text>
                </Button>
              ))}
              <Button
                variant={null}
                onClick={() =>
                  handleSelectOption({
                    contracts: claimableRewardContractAddresses.length
                      ? claimableRewardContractAddresses
                      : undefined
                  })
                }
                className={cn(
                  'text-text flex h-13.5 w-full items-center justify-start gap-2.5 rounded-lg px-4 py-3 text-sm transition-colors',
                  'from-card to-card hover:from-primary-start hover:to-primary-end bg-radial-(--gradient-position)'
                )}
              >
                <Rewards className="h-7 w-7" />
                <Text variant="medium">Claim all rewards</Text>
              </Button>
            </VStack>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="chip"
          onClick={() =>
            handleSelectOption({
              contracts: claimableRewardContractAddresses.length
                ? claimableRewardContractAddresses
                : undefined
            })
          }
          className="h-fit px-2 py-1.5"
        >
          <Text variant="medium" className="leading-4">
            Claim all
          </Text>
        </Button>
        <Rewards className="h-9 w-9" />
      </div>
    </div>
  );
}
