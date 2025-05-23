import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { useContext, useEffect, useMemo, useState } from 'react';
import { SealModuleWidgetContext } from '../context/context';
import {
  TOKENS,
  useDelegateOwner,
  useRewardContractTokens,
  useStakeUrnAddress,
  useUrnSelectedRewardContract,
  useUrnSelectedVoteDelegate,
  useVault,
  ZERO_ADDRESS,
  useCurrentUrnIndex as useStakeCurrentUrnIndex,
  useStakeUrnSelectedVoteDelegate,
  useStakeUrnSelectedRewardContract
} from '@jetstreamgg/hooks';
import { formatAddress, formatBigInt, math } from '@jetstreamgg/utils';
import { Checkbox } from '@widgets/components/ui/checkbox';
import { Card, CardContent } from '@widgets/components/ui/card';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@widgets/components/ui/select';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { LineItem } from './LineItem';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { t } from '@lingui/core/macro';
import { cn } from '@widgets/lib/utils';
import { JazziconComponent } from '@widgets/widgets/StakeModuleWidget/components/Jazzicon';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';

export const MigrateAbout = () => {
  const {
    setIsLockCompleted,
    setIsBorrowCompleted,
    setNewStakeUrn,
    acceptedMkrUpgrade,
    setAcceptedMkrUpgrade,
    activeUrn,
    newStakeUrn,
    setSelectedDelegate,
    setSelectedRewardContract
  } = useContext(SealModuleWidgetContext);
  const [selectedUrnIndex, setSelectedUrnIndex] = useState<bigint | undefined>(undefined);
  const { data: currentStakeUrnIndex } = useStakeCurrentUrnIndex();
  const stakeUrnIndex = selectedUrnIndex !== undefined ? selectedUrnIndex : 0n;
  const { data: stakeUrnAddress, isLoading: isStakeUrnAddressLoading } = useStakeUrnAddress(stakeUrnIndex);

  const { data: vaultData } = useVault(activeUrn?.urnAddress || ZERO_ADDRESS);
  const { data: existingRewardContract } = useUrnSelectedRewardContract({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const { data: existingStakeRewardContract } = useStakeUrnSelectedRewardContract({
    urn: stakeUrnAddress || ZERO_ADDRESS
  });

  const { data: existingRewardContractTokens, isLoading: isRewardContractTokensLoading } =
    useRewardContractTokens(existingRewardContract);

  const { data: existingStakeRewardContractTokens } = useRewardContractTokens(existingStakeRewardContract);

  const { data: existingSelectedVoteDelegate } = useUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  // Get the delegate from the selected stake urn to show in the UI
  const { data: existingStakeSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: stakeUrnAddress || ZERO_ADDRESS
  });

  const { data: existingDelegateOwner } = useDelegateOwner(existingSelectedVoteDelegate);

  const isStakeUrnCreated =
    !!stakeUrnAddress && stakeUrnAddress !== ZERO_ADDRESS && !isStakeUrnAddressLoading;

  // We automatically complete this steps to proceed with migration flow
  // TODO: make sure to clear this if the user clicks back to enter manage flow
  useEffect(() => {
    setIsLockCompleted(true);
    setIsBorrowCompleted(true);
    setAcceptedMkrUpgrade(false);
  }, []);

  useEffect(() => {
    if (selectedUrnIndex !== undefined) {
      setNewStakeUrn({ urnAddress: stakeUrnAddress, urnIndex: stakeUrnIndex }, () => {});
    }
  }, [stakeUrnIndex, selectedUrnIndex, stakeUrnAddress]);

  useEffect(() => {
    setSelectedRewardContract(existingStakeRewardContract);
  }, [existingStakeRewardContract]);

  useEffect(() => {
    setSelectedDelegate(existingStakeSelectedVoteDelegate);
  }, [existingStakeSelectedVoteDelegate]);

  const sealedPositionItems = useMemo(() => {
    return [
      {
        label: t`Sealing`,
        updated: false,
        value: `${formatBigInt(vaultData?.collateralAmount || 0n)} ${TOKENS.mkr.symbol}`,
        icon: <TokenIcon noChain token={TOKENS.mkr} className="h-5 w-5" />
      },
      {
        label: t`Borrowing`,
        updated: false,
        value: `${formatBigInt(vaultData?.debtValue || 0n)} ${TOKENS.usds.symbol}`,
        icon: <TokenIcon noChain token={TOKENS.usds} className="h-5 w-5" />
      },
      {
        label: t`Seal reward`,
        updated: false,
        value: existingRewardContractTokens
          ? existingRewardContractTokens?.rewardsToken.symbol
          : t`No reward`,
        icon:
          existingRewardContractTokens && !isRewardContractTokensLoading ? (
            <TokenIcon noChain token={existingRewardContractTokens?.rewardsToken} className="h-5 w-5" />
          ) : undefined
      },
      {
        label: t`Delegate`,
        updated: false,
        value: existingDelegateOwner ? formatAddress(existingDelegateOwner, 5, 3) : t`No delegate`,
        icon: <JazziconComponent address={existingDelegateOwner} diameter={20} />
      }
    ];
  }, [
    vaultData?.debtValue,
    vaultData?.collateralAmount,
    existingRewardContractTokens?.rewardsToken.symbol,
    existingDelegateOwner
  ]);

  const stakingPositionItems = useMemo(() => {
    return [
      {
        label: t`Collateral to migrate and upgrade`,
        updated: false,
        value: vaultData?.collateralAmount
          ? [
              `${formatBigInt(vaultData?.collateralAmount || 0n)} ${TOKENS.mkr.symbol}`,
              `${formatBigInt(math.calculateConversion(TOKENS.mkr, vaultData?.collateralAmount || 0n))} ${TOKENS.sky.symbol}`
            ]
          : '0 MKR',
        icon: <TokenIcon noChain token={TOKENS.mkr} className="h-5 w-5" />
      },
      {
        label: t`Debt to migrate`,
        updated: false,
        value: vaultData?.debtValue
          ? `${formatBigInt(vaultData?.debtValue || 0n)} ${TOKENS.usds.symbol}`
          : '0 USDS',
        icon: <TokenIcon noChain token={TOKENS.usds} className="h-5 w-5" />
      },
      {
        label: t`Staking Reward`,
        updated: false,
        value: existingStakeRewardContractTokens?.rewardsToken
          ? existingStakeRewardContractTokens?.rewardsToken.symbol
          : t`Cannot be migrated`,
        icon: <TokenIcon noChain token={TOKENS.usds} className="h-5 w-5" />
      },
      {
        label: t`Delegate`,
        updated: false,
        value:
          existingStakeSelectedVoteDelegate && existingStakeSelectedVoteDelegate !== ZERO_ADDRESS
            ? formatAddress(existingStakeSelectedVoteDelegate, 5, 3)
            : t`Cannot be migrated`,
        icon: <JazziconComponent address={ZERO_ADDRESS} diameter={20} />
      }
    ];
  }, [
    vaultData?.debtValue,
    vaultData?.collateralAmount,
    existingStakeSelectedVoteDelegate,
    existingStakeRewardContractTokens
  ]);

  return (
    <div className="mb-4">
      <Heading variant="medium">
        <Trans>Migration</Trans>
      </Heading>
      <img className="mt-4" src="/images/banner_migration.png" alt="banner_migration" />
      <Text className="mt-4">
        <Trans>
          You are migrating your position from the Seal Engine to the Staking Engine. No exist fee applies.
          Please check the acknowledgement box below to proceed.
        </Trans>
      </Text>
      <Text className="mt-4">
        <Trans>Migrate from:</Trans>
      </Text>
      <InfoCard
        title={
          isStakeUrnCreated
            ? t`Your Seal Position ${activeUrn?.urnIndex !== undefined ? `${activeUrn?.urnIndex + 1n}` : ''}`
            : t`Seal Position ${activeUrn?.urnIndex !== undefined ? `${activeUrn?.urnIndex + 1n}` : ''}`
        }
        lineItemsFiltered={sealedPositionItems}
        className="mt-4"
        dataTestId="migrate-from-card"
        position="top"
      />
      <Text className="mt-4">
        <Trans>Migrate to:</Trans>
      </Text>
      {!isStakeUrnCreated && (
        <>
          <Text className="text-textSecondary mt-4">
            <Trans>To migrate, you&apos;ll need an open staking position.</Trans>
          </Text>
        </>
      )}
      <InfoCard
        lineItemsFiltered={stakingPositionItems}
        title={
          isStakeUrnCreated
            ? t`Staking position ${newStakeUrn === undefined ? '' : stakeUrnIndex !== undefined ? `${stakeUrnIndex + 1n}` : ''}`
            : t`Open new Staking position`
        }
        className={`mt-4 ${isStakeUrnCreated ? '' : 'border-2 border-dashed'}`}
        dataTestId="migrate-to-card"
        showSelector
        currentStakeUrnIndex={currentStakeUrnIndex}
        setSelectedUrnIndex={setSelectedUrnIndex}
        selectedUrnIndex={selectedUrnIndex}
        position="bottom"
      />
      <div className="mt-4">
        <div className="flex gap-2">
          <Checkbox
            className="mt-1"
            checked={acceptedMkrUpgrade}
            onCheckedChange={(checked: boolean) => {
              setAcceptedMkrUpgrade(checked === true);
            }}
          />
          <div
            className="cursor-pointer"
            onClick={() => {
              setAcceptedMkrUpgrade(!acceptedMkrUpgrade);
            }}
          >
            <Text variant="medium" className="text-textSecondary">
              <Trans>
                I acknowledge that my MKR collateral will be upgraded to SKY and that this action is
                irreversible.
              </Trans>
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({
  lineItemsFiltered,
  title,
  className,
  dataTestId,
  showSelector = false,
  currentStakeUrnIndex,
  setSelectedUrnIndex,
  selectedUrnIndex,
  position
}: {
  lineItemsFiltered: Record<string, any>[];
  title: string;
  className?: string;
  dataTestId?: string;
  showSelector?: boolean;
  currentStakeUrnIndex?: bigint;
  selectedUrnIndex?: bigint;
  position: 'top' | 'bottom';
  setSelectedUrnIndex?: (index: bigint | undefined) => void;
}) => {
  const { newStakeUrn } = useContext(SealModuleWidgetContext);

  interface UrnOption {
    value: string;
    label: string;
  }

  const numericUrnIndices = useMemo(() => {
    const indices: number[] = [];
    if (currentStakeUrnIndex !== undefined) {
      const endIdx = Number(currentStakeUrnIndex); // Convert BigInt to Number for loop limit
      for (let i = 1; i <= endIdx; i++) {
        indices.push(i); // Store the number itself
      }
    }
    return indices;
  }, [currentStakeUrnIndex]);

  const urnOptions = useMemo<UrnOption[]>(() => {
    const createNewOption: UrnOption = { value: 'create_new', label: 'Create new Stake Position' };
    const existingUrnOptions: UrnOption[] = numericUrnIndices.map(index => ({
      value: index.toString(),
      label: `Position ${index.toString()}`
    }));
    return [createNewOption, ...existingUrnOptions];
  }, [numericUrnIndices]);

  const noStakePositionsOpen = selectedUrnIndex === undefined && currentStakeUrnIndex === 0n;

  useEffect(() => {
    // Automatically select Open new option if there are no existing positions
    if (newStakeUrn?.urnIndex !== undefined) {
      setSelectedUrnIndex?.(newStakeUrn.urnIndex);
    } else if (noStakePositionsOpen) {
      setSelectedUrnIndex?.(currentStakeUrnIndex);
    }
  }, []);

  return (
    <Card className={cn(className)} data-testid={dataTestId}>
      <CardContent>
        <MotionVStack gap={2} variants={positionAnimations} className="space-y-3">
          <motion.div key="overview" variants={positionAnimations}>
            <Text variant="medium" className="mb-1 font-medium">
              {title}
            </Text>
            {showSelector && currentStakeUrnIndex !== undefined && (
              <VStack gap={2} className="my-4">
                <Text variant="small" className="text-textSecondary">
                  Select an existing Stake position to migrate to, or create a new one:
                </Text>
                <Select
                  onValueChange={val => {
                    if (val === 'create_new') {
                      setSelectedUrnIndex?.(currentStakeUrnIndex);
                    } else {
                      setSelectedUrnIndex?.(BigInt(val) - 1n);
                    }
                  }}
                  value={
                    selectedUrnIndex === currentStakeUrnIndex || noStakePositionsOpen
                      ? 'create_new'
                      : selectedUrnIndex !== undefined
                        ? (selectedUrnIndex + 1n).toString()
                        : undefined
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent className="bg-container text-text backdrop-blur-[50px]">
                    <SelectGroup data-testid="select-position-dropdown">
                      {urnOptions.map(option => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="cursor-pointer hover:bg-[#FFFFFF0D]"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </VStack>
            )}
            <div className={position === 'bottom' ? 'flex flex-wrap justify-between' : ''}>
              {lineItemsFiltered
                .filter(item => !!item.value)
                .map((i, index) => {
                  const { label, value, icon, className, tooltipText } = i;
                  return (
                    <LineItem
                      key={label}
                      label={label}
                      value={value}
                      tooltipText={tooltipText}
                      icon={icon}
                      className={className}
                      labelAlignment={position === 'top' ? 'horizontal' : 'vertical'}
                      containerClassName={
                        position === 'bottom' ? (index === 0 ? 'w-full' : 'w-1/2') : undefined
                      }
                    />
                  );
                })}
            </div>
          </motion.div>
        </MotionVStack>
      </CardContent>
    </Card>
  );
};
