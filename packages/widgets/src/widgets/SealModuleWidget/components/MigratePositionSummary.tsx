import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useContext, useEffect, useMemo } from 'react';
import { SealModuleWidgetContext } from '../context/context';
import {
  TOKENS,
  ZERO_ADDRESS,
  getIlkName,
  useRewardContractTokens,
  useSimulatedVault,
  useStakeUrnSelectedRewardContract as useUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate as useUrnSelectedVoteDelegate,
  useVault,
  useSealExitFee,
  useDelegateName,
  useDelegateOwner,
  useCollateralData
} from '@jetstreamgg/hooks';
import { useChainId } from 'wagmi';
import { Card, CardContent } from '@widgets/components/ui/card';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { motion } from 'framer-motion';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { WAD_PRECISION, captitalizeFirstLetter, formatBigInt, formatPercent, math } from '@jetstreamgg/utils';
import { formatUnits } from 'viem';
import { getRiskTextColor } from '../lib/utils';
import { JazziconComponent } from './Jazzicon';
import {
  collateralizationRatioTooltipText,
  liquidationPriceTooltipText,
  riskLevelTooltipText,
  borrowRateTooltipText
} from '../lib/constants';
import { LineItem } from './LineItem';

const { usds, mkr } = TOKENS;

const isUpdatedValue = (prev: any, next: any) => prev !== undefined && next !== undefined && prev !== next;
// const getSealLabel = (prev: bigint | undefined, next: bigint | undefined) => {
//   if (prev === undefined || next === undefined) return t`Sealing`;
//   return next > prev ? t`Sealing` : next < prev ? t`Unsealing` : t`Sealed`;
// };
// const getBorrowLabel = (prev: bigint | undefined, next: bigint | undefined) => {
//   if (prev === undefined || next === undefined) return t`Borrowing`;
//   return next > prev ? t`Borrowing` : next < prev ? t`Repaying` : t`Borrowed`;
// };

export const MigratePositionSummary = () => {
  const chainId = useChainId();
  const ilkName = getIlkName(chainId);
  const stakingEngineIlkName = getIlkName(chainId, 2);

  const {
    activeUrn,
    mkrToFree,
    skyToFree,
    selectedDelegate,
    selectedRewardContract,
    selectedToken,
    displayToken,
    setDisplayToken
  } = useContext(SealModuleWidgetContext);
  const { data: existingRewardContract } = useUrnSelectedRewardContract({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const { data: existingRewardContractTokens, isLoading: isRewardContractTokensLoading } =
    useRewardContractTokens(existingRewardContract);

  // This needs to come from staking, check that this hook is returning the expected data
  const { data: selectedRewardContractTokens, isLoading: isSelectedContractTokensLoading } =
    useRewardContractTokens(selectedRewardContract);

  // This correctly comes from Seal
  const { data: existingSelectedVoteDelegate, isLoading: isDelegateLoading } = useUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const { data: existingDelegateName } = useDelegateName(existingSelectedVoteDelegate);
  const { data: existingDelegateOwner, isLoading: loadingExistingDelegateOwner } = useDelegateOwner(
    existingSelectedVoteDelegate
  );

  // These two need to come from staking, make sure the hooks are returning the expected data
  const { data: selectedDelegateName } = useDelegateName(selectedDelegate);
  const { data: selectedDelegateOwner, isLoading: loadingSelectedDelegateOwner } =
    useDelegateOwner(selectedDelegate);

  // techncially we know there is an existing fault now bc we're migrating but maybe
  // its ok to fetch again
  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);
  const hasPositions = !!existingVault;

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  // const newBorrowAmount = usdsToBorrow + (existingVault?.debtValue || 0n) - usdsToWipe;
  // NEW there is no user input for borrow or wipe
  const newBorrowAmount = existingVault?.debtValue || 0n;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  // const collateralToLock =
  //   selectedToken === mkr ? mkrToLock : math.calculateConversion(TOKENS.sky, skyToLock);
  // const collateralToFree =
  //   selectedToken === mkr ? mkrToFree : math.calculateConversion(TOKENS.sky, skyToFree);
  // const newCollateralAmount = collateralToLock + (existingVault?.collateralAmount || 0n) - collateralToFree;

  // there will be no collateral to lock or free
  // const newCollateralAmount = collateralToLock + (existingVault?.collateralAmount || 0n) - collateralToFree;
  // NEW here we need to refactor this to "collateral to migrate" which will be denominated in SKY
  const newCollateralAmount = existingVault?.collateralAmount || 0n;

  // NEW I think this needs to be the stake version, using the stake params
  const { data: updatedVault } = useSimulatedVault(
    newCollateralAmount,
    newBorrowAmount,
    existingVault?.debtValue || 0n
  );

  // We are guaranteed to have positions, so we can set this variables without the conditional
  const delegateNameToDisplay = selectedDelegateName;
  const delegateOwnerToDisplay = selectedDelegateOwner;
  const rewardsTokensToDisplay = selectedRewardContractTokens;
  const vaultToDisplay = updatedVault;
  const isRiskLevelUpdated =
    hasPositions && isUpdatedValue(existingVault?.riskLevel, updatedVault?.riskLevel);

  // This correctly uses seal engine hook
  const { data: exitFee } = useSealExitFee();

  // these are correct
  const existingCollateralAmount =
    displayToken === mkr
      ? existingVault?.collateralAmount || 0n
      : math.calculateConversion(mkr, existingVault?.collateralAmount || 0n);
  const updatedCollateralAmount =
    displayToken === mkr
      ? updatedVault?.collateralAmount || 0n
      : math.calculateConversion(mkr, updatedVault?.collateralAmount || 0n);

  // these are correct
  const existingLiquidationPrice =
    displayToken === mkr
      ? existingVault?.liquidationPrice || 0n
      : math.calculateMKRtoSKYPrice(existingVault?.liquidationPrice || 0n);
  const updatedLiquidationPrice =
    displayToken === mkr
      ? updatedVault?.liquidationPrice || 0n
      : math.calculateMKRtoSKYPrice(updatedVault?.liquidationPrice || 0n);

  // collateral data will be for lockstake sky
  const { data: collateralData } = useCollateralData(stakingEngineIlkName);

  // If the contract is ZERO_ADDRESS, we need to treat it as undefined
  const validatedExistingRewardsContract =
    existingRewardContract && existingRewardContract !== ZERO_ADDRESS ? existingRewardContract : undefined;
  const validatedExistingSelectedVoteDelegate =
    existingSelectedVoteDelegate && existingSelectedVoteDelegate !== ZERO_ADDRESS
      ? existingSelectedVoteDelegate
      : undefined;

  const lineItems = useMemo(() => {
    return [
      {
        label: t`Exit fee`,
        updated: hasPositions && (mkrToFree > 0n || skyToFree > 0n),
        value:
          hasPositions && (mkrToFree > 0n || skyToFree > 0n) && typeof exitFee === 'bigint'
            ? [
                `${Number(formatUnits((displayToken === mkr ? mkrToFree : math.calculateConversion(mkr, mkrToFree)) * exitFee, WAD_PRECISION * 2)).toFixed(2)} ${displayToken.symbol}`
              ]
            : '',
        icon: <TokenIcon token={displayToken} className="h-5 w-5" />
      },
      {
        // label: getSealLabel(existingVault?.collateralAmount, updatedVault?.collateralAmount),
        label: 'Collateral to migrate and upgrade',
        updated:
          hasPositions && isUpdatedValue(existingVault?.collateralAmount, updatedVault?.collateralAmount),
        value:
          hasPositions && isUpdatedValue(existingVault?.collateralAmount, updatedVault?.collateralAmount)
            ? [
                `${formatBigInt(existingCollateralAmount)} ${displayToken.symbol}`,
                `${formatBigInt(updatedCollateralAmount)} ${displayToken.symbol}`
              ]
            : hasPositions
              ? `${formatBigInt(existingCollateralAmount)} ${displayToken.symbol}`
              : `${formatBigInt(updatedCollateralAmount)} ${displayToken.symbol}`,
        icon: <TokenIcon token={displayToken} className="h-5 w-5" />
      },
      {
        // label: getBorrowLabel(existingVault?.debtValue, updatedVault?.debtValue),
        label: 'Debt to migrate',
        updated: hasPositions && isUpdatedValue(existingVault?.debtValue, updatedVault?.debtValue),
        value:
          hasPositions && isUpdatedValue(existingVault?.debtValue, updatedVault?.debtValue)
            ? [
                `${formatBigInt(existingVault?.debtValue || 0n)} ${usds.symbol}`,
                `${formatBigInt(updatedVault?.debtValue || 0n)} ${usds.symbol}`
              ]
            : hasPositions
              ? `${formatBigInt(existingVault?.debtValue || 0n)} ${usds.symbol}`
              : `${formatBigInt(updatedVault?.debtValue || 0n)} ${usds.symbol}`,
        icon: <TokenIcon token={usds} className="h-5 w-5" />,
        hideIfNoDebt: true
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
        tooltipText: collateralizationRatioTooltipText,
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
        label: t`Borrow rate`,
        value: collateralData?.stabilityFee ? formatPercent(collateralData?.stabilityFee) : undefined,
        hideIfNoDebt: true,
        tooltipText: borrowRateTooltipText
      },
      {
        label: t`Current ${displayToken.symbol} price`,
        value: `$${formatBigInt(displayToken === mkr ? updatedVault?.delayedPrice || 0n : math.calculateMKRtoSKYPrice(updatedVault?.delayedPrice || 0n), { unit: WAD_PRECISION })}`
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
        tooltipText: liquidationPriceTooltipText,
        hideIfNoDebt: true
      },
      {
        label: t`Risk level`,
        updated: isRiskLevelUpdated,
        value: isRiskLevelUpdated
          ? [
              `${captitalizeFirstLetter(existingVault?.riskLevel?.toLowerCase() || '')}`,
              `${captitalizeFirstLetter(updatedVault?.riskLevel?.toLowerCase() || '')}`
            ]
          : `${captitalizeFirstLetter(updatedVault?.riskLevel?.toLowerCase() || '')}`,
        className: isRiskLevelUpdated
          ? [getRiskTextColor(existingVault?.riskLevel), getRiskTextColor(updatedVault?.riskLevel)]
          : getRiskTextColor(vaultToDisplay?.riskLevel),
        tooltipText: riskLevelTooltipText,
        hideIfNoDebt: true
      },
      {
        label: t`Staking reward`,
        updated:
          hasPositions &&
          isUpdatedValue(
            validatedExistingRewardsContract?.toLowerCase(),
            selectedRewardContract?.toLowerCase()
          ),
        value:
          hasPositions &&
          isUpdatedValue(
            validatedExistingRewardsContract?.toLowerCase(),
            selectedRewardContract?.toLowerCase()
          )
            ? [
                existingRewardContractTokens?.rewardsToken.symbol,
                selectedRewardContractTokens?.rewardsToken.symbol
              ]
            : rewardsTokensToDisplay?.rewardsToken.symbol,
        icon:
          hasPositions &&
          isUpdatedValue(
            validatedExistingRewardsContract?.toLowerCase(),
            selectedRewardContract?.toLowerCase()
          ) ? (
            [
              isRewardContractTokensLoading || !existingRewardContractTokens ? (
                <Skeleton className="w-30 h-5" />
              ) : (
                <TokenIcon token={existingRewardContractTokens?.rewardsToken} className="h-5 w-5" />
              ),
              isSelectedContractTokensLoading || !selectedRewardContractTokens ? (
                <Skeleton className="w-30 h-5" />
              ) : (
                <TokenIcon token={selectedRewardContractTokens?.rewardsToken} className="h-5 w-5" />
              )
            ]
          ) : isRewardContractTokensLoading || !rewardsTokensToDisplay ? (
            <Skeleton className="w-30 h-5" />
          ) : (
            <TokenIcon token={rewardsTokensToDisplay?.rewardsToken} className="h-5 w-5" />
          )
      },
      {
        label: t`Delegate`,
        updated:
          hasPositions &&
          isUpdatedValue(
            validatedExistingSelectedVoteDelegate?.toLowerCase(),
            selectedDelegate?.toLowerCase()
          ),
        value:
          hasPositions &&
          isUpdatedValue(
            validatedExistingSelectedVoteDelegate?.toLowerCase(),
            selectedDelegate?.toLowerCase()
          )
            ? [
                !!validatedExistingSelectedVoteDelegate &&
                existingDelegateName &&
                existingDelegateName !== 'Shadow delegate'
                  ? existingDelegateName
                  : validatedExistingSelectedVoteDelegate &&
                      validatedExistingSelectedVoteDelegate !== ZERO_ADDRESS
                    ? validatedExistingSelectedVoteDelegate?.slice(0, 5) +
                      '...' +
                      validatedExistingSelectedVoteDelegate?.slice(-3)
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
          isUpdatedValue(
            validatedExistingSelectedVoteDelegate?.toLowerCase(),
            selectedDelegate?.toLowerCase()
          ) ? (
            [
              loadingExistingDelegateOwner || !existingDelegateOwner ? (
                <Skeleton className="w-30 h-5" />
              ) : (
                <JazziconComponent address={existingDelegateOwner} diameter={20} />
              ),
              loadingSelectedDelegateOwner || !selectedDelegateOwner ? (
                <Skeleton className="w-30 h-5" />
              ) : (
                <JazziconComponent address={selectedDelegateOwner} diameter={20} />
              )
            ]
          ) : isDelegateLoading || !delegateOwnerToDisplay ? (
            <Skeleton className="w-30 h-5" />
          ) : (
            <JazziconComponent address={delegateOwnerToDisplay} diameter={20} />
          )
      }
    ];
  }, [
    existingVault,
    updatedVault,
    existingRewardContract,
    validatedExistingRewardsContract,
    selectedRewardContract,
    existingRewardContractTokens,
    selectedRewardContractTokens,
    isRewardContractTokensLoading,
    existingSelectedVoteDelegate,
    validatedExistingSelectedVoteDelegate,
    existingDelegateName,
    existingDelegateOwner,
    selectedDelegate,
    selectedDelegateName,
    selectedDelegateOwner,
    isDelegateLoading,
    displayToken,
    exitFee
  ]);

  // If there's no borrowing, filter out items related to it
  const lineItemsFiltered =
    (existingVault?.debtValue === 0n || existingVault?.debtValue === undefined) &&
    (updatedVault?.debtValue === 0n || updatedVault?.debtValue === undefined)
      ? lineItems.filter(item => !item.hideIfNoDebt)
      : lineItems;

  useEffect(() => {
    setDisplayToken(selectedToken);
  }, [selectedToken]);

  return (
    <motion.div variants={positionAnimations}>
      <Heading className="mb-4">
        <Trans>Position summary</Trans>
      </Heading>
      <Card>
        <CardContent>
          <MotionVStack gap={2} variants={positionAnimations} className="space-y-3">
            <motion.div key="overview" variants={positionAnimations} data-testid="position-summary-card">
              <Text variant="medium" className="mb-1 font-medium">
                Staking Engine position overview
              </Text>
              {lineItemsFiltered
                .filter(item => /*!item.updated &&*/ !!item.value)
                .map(i => {
                  const { label, value, icon, className, tooltipText } = i;
                  return (
                    <LineItem
                      key={label}
                      label={label}
                      value={value}
                      tooltipText={tooltipText}
                      icon={icon}
                      className={className}
                    />
                  );
                })}
            </motion.div>
          </MotionVStack>
        </CardContent>
      </Card>
    </motion.div>
  );
};
