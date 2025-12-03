import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { JSX, useContext, useEffect, useMemo } from 'react';
import { StakeModuleWidgetContext } from '../context/context';
import {
  TOKENS,
  ZERO_ADDRESS,
  getIlkName,
  useRewardContractTokens,
  useSimulatedVault,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  useVault,
  useSealExitFee,
  useDelegateName,
  useDelegateOwner,
  useCollateralData,
  Token,
  useIsBatchSupported,
  useRewardContractsToClaim,
  useStakeRewardContracts
} from '@jetstreamgg/sky-hooks';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { motion } from 'framer-motion';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { WAD_PRECISION, capitalizeFirstLetter, formatBigInt, formatPercent } from '@jetstreamgg/sky-utils';
import { cn } from '@widgets/lib/utils';
import { getRiskTextColor } from '../lib/utils';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { ArrowDown } from '@widgets/shared/components/icons/ArrowDown';
import { JazziconComponent } from './Jazzicon';
import { PopoverInfo } from '@widgets/shared/components/ui/PopoverInfo';
import { getTooltipById } from '../../../data/tooltips';
import {
  StakeFlow,
  stakeOpenReviewTitle,
  getStakeOpenReviewSubtitle,
  stakeManageReviewTitle,
  getStakeManageReviewSubtitle
} from '../lib/constants';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { BatchStatus } from '@widgets/shared/constants';
import { useChainId } from 'wagmi';
import { Checkbox } from '@widgets/components/ui/checkbox';

const { usds } = TOKENS;
const TOKENS_BY_SYMBOL = Object.values(TOKENS).reduce<Record<string, Token>>((accumulator, token) => {
  accumulator[token.symbol.toUpperCase()] = token;
  return accumulator;
}, {});

const isUpdatedValue = (prev: any, next: any) => prev !== undefined && next !== undefined && prev !== next;
const getStakeLabel = (prev: bigint | undefined, next: bigint | undefined) => {
  if (prev === undefined || next === undefined) return t`Staking`;
  return next > prev ? t`Staking` : next < prev ? t`Unstaking` : t`Staked`;
};
const getBorrowLabel = (prev: bigint | undefined, next: bigint | undefined) => {
  if (prev === undefined || next === undefined) return t`Borrowing`;
  return next > prev ? t`Borrowing` : next < prev ? t`Repaying` : t`Borrowed`;
};

const normalizeDelegate = (delegate: string | undefined): string => {
  if (!delegate || delegate === ZERO_ADDRESS) {
    return ZERO_ADDRESS;
  }
  return delegate.toLowerCase();
};

const LineItem = ({
  label,
  value,
  icon,
  className,
  tooltipTitle,
  tooltipText
}: {
  label: string;
  value?: string | (string | undefined)[] | string[];
  icon?: JSX.Element | (JSX.Element | null)[] | null;
  className?: string | string[];
  tooltipTitle?: string;
  tooltipText?: string;
}) => {
  return (
    <motion.div key={label} className="flex justify-between py-2" variants={positionAnimations}>
      <HStack className="items-center" gap={1}>
        <Text className={'text-textSecondary flex items-center text-sm'}>
          {label}
          {label === 'Rate' && (
            <span className="mt-1 ml-2">
              <PopoverRateInfo type="ssr" />
            </span>
          )}
        </Text>
        {tooltipText && (
          <PopoverInfo
            title={tooltipTitle || ''}
            description={tooltipText}
            iconClassName="text-textSecondary"
          />
        )}
      </HStack>
      {Array.isArray(value) && value.length >= 2 ? (
        <HStack className="shrink-0 items-center">
          <div className="flex items-center gap-2">
            {Array.isArray(icon) ? icon[0] : icon}
            <Text
              className={cn(
                Array.isArray(className) && className.length >= 2 ? className[0] : className,
                'text-right text-sm'
              )}
            >
              {value[0]}
            </Text>
          </div>
          {value[0] && <ArrowDown className="-rotate-90" boxSize={12} />}
          <div className="flex items-center gap-2">
            {Array.isArray(icon) && icon.length === 2 && icon[1]}
            <Text
              className={`${
                Array.isArray(className) && className.length >= 2 ? className[1] : className
              } text-right text-sm`}
            >
              {value[1]}
            </Text>
          </div>
        </HStack>
      ) : (
        <div className="flex items-center gap-2">
          {icon}
          <Text className={cn(className, 'text-right text-sm')}>{value}</Text>
        </div>
      )}
    </motion.div>
  );
};

export const PositionSummary = ({
  needsAllowance,
  allowanceToken,
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  legalBatchTxUrl,
  onNoChangesDetected
}: {
  needsAllowance: boolean;
  allowanceToken?: Token;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  legalBatchTxUrl?: string;
  onNoChangesDetected?: (hasNoChanges: boolean) => void;
}) => {
  const ilkName = getIlkName(2);
  const { i18n } = useLingui();
  const { data: batchSupported } = useIsBatchSupported();
  const chainId = useChainId();

  const {
    activeUrn,
    skyToLock,
    skyToFree,
    usdsToBorrow,
    usdsToWipe,
    selectedDelegate,
    selectedRewardContract,
    rewardContractsToClaim,
    setRewardContractsToClaim,
    restakeSkyRewards,
    setRestakeSkyRewards,
    restakeSkyAmount,
    isSkyRewardPosition
  } = useContext(StakeModuleWidgetContext);
  const { setTxTitle, setTxSubtitle, setStepTwoTitle, widgetState } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;
  const { data: stakeRewardContracts } = useStakeRewardContracts();

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === StakeFlow.OPEN) {
      setStepTwoTitle(t`Open a position`);
      setTxTitle(i18n._(stakeOpenReviewTitle));
      setTxSubtitle(
        i18n._(
          getStakeOpenReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: allowanceToken?.symbol,
            needsAllowance
          })
        )
      );
    } else if (flow === StakeFlow.MANAGE) {
      setStepTwoTitle(t`Change Position`);
      setTxTitle(i18n._(stakeManageReviewTitle));
      setTxSubtitle(
        i18n._(
          getStakeManageReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: allowanceToken?.symbol,
            needsAllowance
          })
        )
      );
    }
  }, [flow, action, screen, i18n.locale, isBatchTransaction, batchEnabled, batchSupported]);

  const { data: existingRewardContract } = useStakeUrnSelectedRewardContract({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const { data: existingRewardContractTokens, isLoading: isRewardContractTokensLoading } =
    useRewardContractTokens(existingRewardContract);
  const { data: selectedRewardContractTokens, isLoading: isSelectedContractTokensLoading } =
    useRewardContractTokens(selectedRewardContract);

  const rewardContractAddresses = useMemo<`0x${string}`[]>(
    () => stakeRewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    [stakeRewardContracts]
  );

  const { data: claimableRewardContracts } = useRewardContractsToClaim({
    rewardContractAddresses,
    addresses: activeUrn?.urnAddress,
    chainId
  });

  const claimableSkyReward = useMemo(
    () =>
      claimableRewardContracts?.find(
        ({ rewardSymbol }) => typeof rewardSymbol === 'string' && rewardSymbol.toUpperCase() === 'SKY'
      ),
    [claimableRewardContracts]
  );
  const hasUnclaimedSkyRewards = !!claimableSkyReward;

  const sortedClaimableRewardContracts = useMemo(() => {
    if (!claimableRewardContracts) return undefined;

    return [...claimableRewardContracts].sort((a, b) => {
      const aIsSky = a.rewardSymbol?.toUpperCase?.() === 'SKY';
      const bIsSky = b.rewardSymbol?.toUpperCase?.() === 'SKY';

      if (aIsSky && !bIsSky) return -1;
      if (!aIsSky && bIsSky) return 1;
      return 0;
    });
  }, [claimableRewardContracts]);

  const rewardContractsSelected = useMemo(
    () => new Set((rewardContractsToClaim ?? []).map(contract => contract.toLowerCase())),
    [rewardContractsToClaim]
  );

  const handleRewardCheckboxChange = (contractAddress: `0x${string}`, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;

    setRewardContractsToClaim(previousContracts => {
      const previous = previousContracts ?? [];
      const normalizedAddress = contractAddress.toLowerCase();
      const hasAddress = previous.some(address => address.toLowerCase() === normalizedAddress);

      if (isChecked) {
        if (hasAddress) {
          return previous;
        }
        return [...previous, contractAddress];
      }

      const filtered = previous.filter(address => address.toLowerCase() !== normalizedAddress);
      return filtered.length > 0 ? filtered : undefined;
    });
  };

  const { data: existingSelectedVoteDelegate, isLoading: isDelegateLoading } =
    useStakeUrnSelectedVoteDelegate({
      urn: activeUrn?.urnAddress || ZERO_ADDRESS
    });

  const { data: existingDelegateName } = useDelegateName(existingSelectedVoteDelegate);
  const { data: existingDelegateOwner, isLoading: loadingExistingDelegateOwner } = useDelegateOwner(
    existingSelectedVoteDelegate
  );
  const { data: selectedDelegateName } = useDelegateName(selectedDelegate);
  const { data: selectedDelegateOwner, isLoading: loadingSelectedDelegateOwner } =
    useDelegateOwner(selectedDelegate);

  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);

  const hasPositions = !!existingVault;

  const restakeContribution = restakeSkyRewards && isSkyRewardPosition ? restakeSkyAmount : 0n;
  const totalSkyToLock = skyToLock + restakeContribution;
  const restakeAvailable = isSkyRewardPosition ? restakeSkyAmount : 0n;
  const restakeToggleDisabled = restakeAvailable === 0n || !hasPositions;

  const handleRestakeToggle = (checked: boolean) => {
    if (checked && restakeToggleDisabled) {
      return;
    }

    setRestakeSkyRewards(checked);

    if (checked && claimableSkyReward) {
      const skyContractAddress = claimableSkyReward.contractAddress;
      setRewardContractsToClaim(previousContracts => {
        const previous = previousContracts ?? [];
        const normalizedSkyAddress = skyContractAddress.toLowerCase();
        const hasSkyAddress = previous.some(address => address.toLowerCase() === normalizedSkyAddress);

        if (hasSkyAddress) {
          return previous;
        }

        return [...previous, skyContractAddress];
      });
    }
  };

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newBorrowAmount = usdsToBorrow + (existingVault?.debtValue || 0n) - usdsToWipe;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const newCollateralAmount = totalSkyToLock + (existingVault?.collateralAmount || 0n) - skyToFree;

  const { data: updatedVault } = useSimulatedVault(
    newCollateralAmount,
    newBorrowAmount,
    existingVault?.debtValue || 0n,
    ilkName
  );

  const delegateNameToDisplay = hasPositions ? existingDelegateName : selectedDelegateName;
  const delegateOwnerToDisplay = hasPositions ? existingDelegateOwner : selectedDelegateOwner;
  const rewardsTokensToDisplay = hasPositions ? existingRewardContractTokens : selectedRewardContractTokens;
  const vaultToDisplay = hasPositions ? existingVault : updatedVault;
  const isRiskLevelUpdated =
    hasPositions && isUpdatedValue(existingVault?.riskLevel, updatedVault?.riskLevel);

  const { data: exitFee } = useSealExitFee();

  const existingCollateralAmount = existingVault?.collateralAmount || 0n;
  const updatedCollateralAmount = updatedVault?.collateralAmount || 0n;

  const existingLiquidationPrice = existingVault?.liquidationPrice || 0n;
  const updatedLiquidationPrice = updatedVault?.liquidationPrice || 0n;

  const { data: collateralData } = useCollateralData(ilkName);

  const lineItems = useMemo(() => {
    return [
      {
        label: getStakeLabel(existingVault?.collateralAmount, updatedVault?.collateralAmount),
        updated:
          hasPositions && isUpdatedValue(existingVault?.collateralAmount, updatedVault?.collateralAmount),
        value:
          hasPositions && isUpdatedValue(existingVault?.collateralAmount, updatedVault?.collateralAmount)
            ? [
                `${formatBigInt(existingCollateralAmount, { compact: true })} SKY`,
                `${formatBigInt(updatedCollateralAmount, { compact: true })} SKY`
              ]
            : hasPositions
              ? `${formatBigInt(existingCollateralAmount, { compact: true })} SKY`
              : `${formatBigInt(updatedCollateralAmount, { compact: true })} SKY`,
        icon: <TokenIcon token={TOKENS.sky} className="h-5 w-5" />
      },
      {
        label: getBorrowLabel(existingVault?.debtValue, updatedVault?.debtValue),
        updated: hasPositions && isUpdatedValue(existingVault?.debtValue, updatedVault?.debtValue),
        value:
          hasPositions && isUpdatedValue(existingVault?.debtValue, updatedVault?.debtValue)
            ? [
                `${formatBigInt(existingVault?.debtValue || 0n, { compact: true })} ${usds.symbol}`,
                `${formatBigInt(updatedVault?.debtValue || 0n, { compact: true })} ${usds.symbol}`
              ]
            : hasPositions
              ? `${formatBigInt(existingVault?.debtValue || 0n, { compact: true })} ${usds.symbol}`
              : `${formatBigInt(updatedVault?.debtValue || 0n, { compact: true })} ${usds.symbol}`,
        icon: <TokenIcon token={usds} className="h-5 w-5" />,
        hideIfNoDebt: true,
        tooltipTitle: getTooltipById('borrow')?.title || '',
        tooltipText: getTooltipById('borrow')?.tooltip || ''
      },
      {
        label: t`Collateralization ratio`,
        updated:
          hasPositions &&
          isUpdatedValue(existingVault?.collateralizationRatio, updatedVault?.collateralizationRatio),
        value:
          hasPositions &&
          isUpdatedValue(existingVault?.collateralizationRatio, updatedVault?.collateralizationRatio)
            ? [
                `${formatPercent(existingVault?.collateralizationRatio || 0n)}`,
                `${formatPercent(updatedVault?.collateralizationRatio || 0n)}`
              ]
            : hasPositions
              ? `${formatPercent(existingVault?.collateralizationRatio || 0n)}`
              : `${formatPercent(updatedVault?.collateralizationRatio || 0n)}`,
        tooltipTitle: getTooltipById('collateralization-ratio')?.title || '',
        tooltipText: getTooltipById('collateralization-ratio')?.tooltip || '',
        className:
          hasPositions &&
          isUpdatedValue(existingVault?.collateralizationRatio, updatedVault?.collateralizationRatio)
            ? [getRiskTextColor(existingVault?.riskLevel), getRiskTextColor(updatedVault?.riskLevel)]
            : getRiskTextColor(vaultToDisplay?.riskLevel),
        hideIfNoDebt: true
      },
      {
        label: t`Liquidation ratio`,
        value: `${formatBigInt((updatedVault?.liquidationRatio || 0n) * 100n, { unit: 'ray' })}%`,
        hideIfNoDebt: true
      },
      {
        label: t`Borrow Rate`,
        value: collateralData?.stabilityFee ? formatPercent(collateralData?.stabilityFee) : undefined,
        hideIfNoDebt: true,
        tooltipTitle: getTooltipById('borrow-rate')?.title || '',
        tooltipText: getTooltipById('borrow-rate')?.tooltip || ''
      },
      {
        label: t`Capped OSM SKY price`,
        value: `$${formatBigInt(updatedVault?.delayedPrice || 0n, { unit: WAD_PRECISION })}`,
        tooltipTitle: getTooltipById('capped-osm-sky-price')?.title || '',
        tooltipText: getTooltipById('capped-osm-sky-price')?.tooltip || ''
      },
      {
        label: t`Liquidation price`,
        updated:
          hasPositions &&
          isUpdatedValue(existingVault?.collateralizationRatio, updatedVault?.collateralizationRatio),
        value:
          hasPositions &&
          isUpdatedValue(existingVault?.collateralizationRatio, updatedVault?.collateralizationRatio)
            ? [
                `$${formatBigInt(existingLiquidationPrice, { unit: WAD_PRECISION })}`,
                `$${formatBigInt(updatedLiquidationPrice, { unit: WAD_PRECISION })}`
              ]
            : `$${formatBigInt(updatedLiquidationPrice, { unit: WAD_PRECISION })}`,
        tooltipTitle: getTooltipById('liquidation-price')?.title || '',
        tooltipText: getTooltipById('liquidation-price')?.tooltip || '',
        hideIfNoDebt: true
      },
      {
        label: t`Risk level`,
        updated: isRiskLevelUpdated,
        value: isRiskLevelUpdated
          ? [
              `${capitalizeFirstLetter(existingVault?.riskLevel?.toLowerCase() || '')}`,
              `${capitalizeFirstLetter(updatedVault?.riskLevel?.toLowerCase() || '')}`
            ]
          : `${capitalizeFirstLetter(updatedVault?.riskLevel?.toLowerCase() || '')}`,
        className: isRiskLevelUpdated
          ? [getRiskTextColor(existingVault?.riskLevel), getRiskTextColor(updatedVault?.riskLevel)]
          : getRiskTextColor(vaultToDisplay?.riskLevel),
        tooltipTitle: getTooltipById('risk-level')?.title || '',
        tooltipText: getTooltipById('risk-level')?.tooltip || '',
        hideIfNoDebt: true
      },
      {
        label: t`Staking reward`,
        updated:
          hasPositions &&
          isUpdatedValue(existingRewardContract?.toLowerCase(), selectedRewardContract?.toLowerCase()),
        value:
          hasPositions &&
          isUpdatedValue(existingRewardContract?.toLowerCase(), selectedRewardContract?.toLowerCase())
            ? [
                existingRewardContractTokens?.rewardsToken.symbol,
                selectedRewardContractTokens?.rewardsToken.symbol
              ]
            : rewardsTokensToDisplay?.rewardsToken.symbol,
        icon:
          hasPositions &&
          isUpdatedValue(existingRewardContract?.toLowerCase(), selectedRewardContract?.toLowerCase()) ? (
            [
              isRewardContractTokensLoading ? (
                <Skeleton key="loading-existing-rewards" className="h-5 w-30" />
              ) : existingRewardContractTokens ? (
                <TokenIcon
                  key="existing-rewards-token"
                  token={existingRewardContractTokens?.rewardsToken}
                  className="h-5 w-5"
                />
              ) : null,
              isSelectedContractTokensLoading ? (
                <Skeleton key="loading-selected-rewards" className="h-5 w-30" />
              ) : selectedRewardContractTokens ? (
                <TokenIcon
                  key="selected-rewards-icon"
                  token={selectedRewardContractTokens?.rewardsToken}
                  className="h-5 w-5"
                />
              ) : null
            ]
          ) : isRewardContractTokensLoading ? (
            <Skeleton className="h-5 w-30" />
          ) : rewardsTokensToDisplay ? (
            <TokenIcon token={rewardsTokensToDisplay?.rewardsToken} className="h-5 w-5" />
          ) : null
      },
      {
        label: t`Delegate`,
        updated:
          hasPositions &&
          normalizeDelegate(existingSelectedVoteDelegate) !== normalizeDelegate(selectedDelegate),
        value:
          hasPositions &&
          normalizeDelegate(existingSelectedVoteDelegate) !== normalizeDelegate(selectedDelegate)
            ? [
                !!existingSelectedVoteDelegate &&
                existingDelegateName &&
                existingDelegateName !== 'Shadow delegate'
                  ? existingDelegateName
                  : existingSelectedVoteDelegate && existingSelectedVoteDelegate !== ZERO_ADDRESS
                    ? existingSelectedVoteDelegate?.slice(0, 5) +
                      '...' +
                      existingSelectedVoteDelegate?.slice(-3)
                    : t`No delegate`,
                !!selectedDelegate && selectedDelegateName && selectedDelegateName !== 'Shadow delegate'
                  ? selectedDelegateName
                  : selectedDelegate && selectedDelegate !== ZERO_ADDRESS
                    ? selectedDelegate?.slice(0, 5) + '...' + selectedDelegate?.slice(-3)
                    : t`No delegate`
              ]
            : selectedDelegate && delegateNameToDisplay && delegateNameToDisplay !== 'Shadow delegate'
              ? delegateNameToDisplay
              : selectedDelegate && selectedDelegate !== ZERO_ADDRESS
                ? selectedDelegate?.slice(0, 6) + '...' + selectedDelegate?.slice(-4)
                : t`No delegate`,
        icon:
          selectedDelegate &&
          hasPositions &&
          normalizeDelegate(existingSelectedVoteDelegate) !== normalizeDelegate(selectedDelegate) ? (
            [
              loadingExistingDelegateOwner ? (
                <Skeleton key="loading-existing-delegate" className="h-5 w-30" />
              ) : existingDelegateOwner ? (
                <JazziconComponent
                  key="existing-delegate-icon"
                  address={existingDelegateOwner}
                  diameter={20}
                />
              ) : null,
              loadingSelectedDelegateOwner ? (
                <Skeleton key="loading-selected-delegate" className="h-5 w-30" />
              ) : selectedDelegateOwner ? (
                <JazziconComponent
                  key="selected-delegate-icon"
                  address={selectedDelegateOwner}
                  diameter={20}
                />
              ) : null
            ]
          ) : isDelegateLoading ? (
            <Skeleton className="h-5 w-30" />
          ) : delegateOwnerToDisplay ? (
            <JazziconComponent address={delegateOwnerToDisplay} diameter={20} />
          ) : null
      }
    ];
  }, [
    existingVault,
    updatedVault,
    existingRewardContract,
    selectedRewardContract,
    existingRewardContractTokens,
    selectedRewardContractTokens,
    isRewardContractTokensLoading,
    existingSelectedVoteDelegate,
    existingDelegateName,
    existingDelegateOwner,
    selectedDelegate,
    selectedDelegateName,
    selectedDelegateOwner,
    isDelegateLoading,
    exitFee,
    restakeContribution,
    totalSkyToLock
  ]);

  // If there's no borrowing, filter out items related to it
  const lineItemsFiltered =
    (existingVault?.debtValue === 0n || existingVault?.debtValue === undefined) &&
    (updatedVault?.debtValue === 0n || updatedVault?.debtValue === undefined)
      ? lineItems.filter(item => !item.hideIfNoDebt)
      : lineItems;
  const lineItemsUpdated = lineItemsFiltered.filter(item => item.updated);

  // Notify parent component if no changes
  useEffect(() => {
    const hasNoChanges = hasPositions && lineItemsUpdated.length === 0 && !rewardContractsToClaim;
    onNoChangesDetected?.(hasNoChanges);
  }, [hasPositions, lineItemsUpdated.length, rewardContractsToClaim, onNoChangesDetected]);

  return (
    <TransactionReview
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      legalBatchTxUrl={legalBatchTxUrl}
      transactionDetail={
        <MotionVStack gap={2} variants={positionAnimations} className="mt-6 space-y-3">
          <motion.div
            key="overview"
            variants={positionAnimations}
            data-testid="position-summary-card"
            className="border-selectActive mt-2 border-t pt-7"
          >
            <Text variant="medium" className="mb-1 font-medium">
              Position overview
            </Text>
            {lineItemsFiltered
              .filter(item => !item.updated && !!item.value)
              .map(({ label, value, icon, className, tooltipTitle, tooltipText }) => {
                return (
                  <LineItem
                    key={label}
                    label={label}
                    value={value}
                    tooltipTitle={tooltipTitle}
                    tooltipText={tooltipText}
                    icon={icon}
                    className={className}
                  />
                );
              })}
          </motion.div>
          {hasPositions && lineItemsUpdated.length > 0 && (
            <motion.div
              key="updates"
              variants={positionAnimations}
              className="border-selectActive mt-3 border-t pt-7"
            >
              <Text variant="medium" className="mb-1 font-medium">
                Position changes
              </Text>
              {lineItemsUpdated.map(({ label, value, icon, className, tooltipTitle, tooltipText }) => {
                return (
                  <LineItem
                    key={label}
                    label={label}
                    value={value}
                    tooltipTitle={tooltipTitle}
                    tooltipText={tooltipText}
                    icon={icon}
                    className={className}
                  />
                );
              })}
            </motion.div>
          )}
          {hasPositions && sortedClaimableRewardContracts?.length && (
            <motion.div
              key="rewards-actions"
              variants={positionAnimations}
              className="border-selectActive mt-3 border-t pt-7"
            >
              <VStack gap={3}>
                <Text variant="medium" className="font-medium">
                  Rewards actions
                </Text>
                {hasUnclaimedSkyRewards && (
                  <div className="flex w-full items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <Text className="text-sm font-medium" id="restake-sky-label">
                        Claim &amp; Restake SKY
                      </Text>
                      <Text className="text-textSecondary mt-1 text-xs" id="restake-sky-description">
                        Use your accrued SKY rewards to increase this position&apos;s staked SKY balance
                        immediately.
                      </Text>
                      {batchSupported === false && (
                        <Text className="text-textSecondary mt-2 text-xs">
                          Your wallet will confirm claim and lock separately.
                        </Text>
                      )}
                    </div>
                    <Checkbox
                      aria-labelledby="restake-sky-label restake-sky-description"
                      checked={restakeSkyRewards}
                      disabled={restakeToggleDisabled}
                      onCheckedChange={checked => handleRestakeToggle(checked === true)}
                    />
                  </div>
                )}
                <VStack gap={2} className="w-full">
                  {sortedClaimableRewardContracts?.map(({ contractAddress, claimBalance, rewardSymbol }) => {
                    const rewardSymbolUpper = rewardSymbol?.toUpperCase?.() ?? '';
                    const rewardToken = rewardSymbolUpper ? TOKENS_BY_SYMBOL[rewardSymbolUpper] : undefined;
                    const normalizedAddress = contractAddress.toLowerCase();
                    const isSkyRewardRow = rewardSymbolUpper === 'SKY';
                    const isChecked =
                      rewardContractsSelected.has(normalizedAddress) || (isSkyRewardRow && restakeSkyRewards);
                    const checkboxDisabled = isSkyRewardRow && restakeSkyRewards;
                    const checkboxId = `claim-${contractAddress}`;

                    return (
                      <div key={contractAddress} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={checkboxId}
                            checked={isChecked}
                            disabled={checkboxDisabled}
                            onCheckedChange={checked => handleRewardCheckboxChange(contractAddress, checked)}
                          />
                          <label
                            htmlFor={checkboxId}
                            className="text-textSecondary cursor-pointer text-sm select-none"
                          >
                            {`Claim ${rewardSymbolUpper}`}
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          {rewardToken && <TokenIcon token={rewardToken} className="h-5 w-5" />}
                          <Text className="text-sm font-medium">
                            {formatBigInt(claimBalance)} {rewardSymbolUpper}
                          </Text>
                        </div>
                      </div>
                    );
                  })}
                </VStack>
              </VStack>
            </motion.div>
          )}
        </MotionVStack>
      }
    />
  );
};
