import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { JSX, useContext, useEffect, useMemo } from 'react';
import { SealModuleWidgetContext } from '../context/context';
import {
  TOKENS,
  ZERO_ADDRESS,
  getIlkName,
  useRewardContractTokens,
  useSimulatedVault,
  useUrnSelectedRewardContract,
  useUrnSelectedVoteDelegate,
  useVault,
  useSealExitFee,
  useDelegateName,
  useDelegateOwner,
  useCollateralData
} from '@jetstreamgg/sky-hooks';
import { Card, CardContent } from '@widgets/components/ui/card';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { motion } from 'framer-motion';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import {
  WAD_PRECISION,
  captitalizeFirstLetter,
  formatBigInt,
  formatPercent,
  math
} from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { cn } from '@widgets/lib/utils';
import { getRiskTextColor } from '../lib/utils';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { ArrowDown } from '@widgets/shared/components/icons/ArrowDown';
import { JazziconComponent } from './Jazzicon';
import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { getTooltipById } from '../../../data/tooltips';

const { usds, mkr } = TOKENS;

const isUpdatedValue = (prev: any, next: any) => prev !== undefined && next !== undefined && prev !== next;
const getSealLabel = (prev: bigint | undefined, next: bigint | undefined) => {
  if (prev === undefined || next === undefined) return t`Sealing`;
  return next > prev ? t`Sealing` : next < prev ? t`Unsealing` : t`Sealed`;
};
const getBorrowLabel = (prev: bigint | undefined, next: bigint | undefined) => {
  if (prev === undefined || next === undefined) return t`Borrowing`;
  return next > prev ? t`Borrowing` : next < prev ? t`Repaying` : t`Borrowed`;
};

const LineItem = ({
  label,
  value,
  icon,
  className,
  tooltipText
}: {
  label: string;
  value?: string | (string | undefined)[] | string[];
  icon?: JSX.Element | (JSX.Element | null)[] | null;
  className?: string | string[];
  tooltipText?: string;
}) => {
  return (
    <motion.div key={label} className="flex justify-between py-2" variants={positionAnimations}>
      <HStack className="items-center" gap={1}>
        <Text className={'text-textSecondary flex items-center text-sm'}>
          {label}
          {label === 'Rate' && (
            <span className="ml-2 mt-1">
              <PopoverRateInfo type="ssr" />
            </span>
          )}
        </Text>
        {tooltipText && <InfoTooltip content={tooltipText} iconClassName="text-textSecondary" />}
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

export const PositionSummary = () => {
  const ilkName = getIlkName(1);

  const {
    activeUrn,
    mkrToLock,
    mkrToFree,
    skyToLock,
    skyToFree,
    usdsToBorrow,
    usdsToWipe,
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
  const { data: selectedRewardContractTokens, isLoading: isSelectedContractTokensLoading } =
    useRewardContractTokens(selectedRewardContract);

  const { data: existingSelectedVoteDelegate, isLoading: isDelegateLoading } = useUrnSelectedVoteDelegate({
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

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newBorrowAmount = usdsToBorrow + (existingVault?.debtValue || 0n) - usdsToWipe;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const collateralToLock =
    selectedToken === mkr ? mkrToLock : math.calculateConversion(TOKENS.sky, skyToLock, 0n);
  const collateralToFree =
    selectedToken === mkr ? mkrToFree : math.calculateConversion(TOKENS.sky, skyToFree, 0n);
  const newCollateralAmount = collateralToLock + (existingVault?.collateralAmount || 0n) - collateralToFree;

  const { data: updatedVault } = useSimulatedVault(
    newCollateralAmount,
    newBorrowAmount,
    existingVault?.debtValue || 0n
  );

  const delegateNameToDisplay = hasPositions ? existingDelegateName : selectedDelegateName;
  const delegateOwnerToDisplay = hasPositions ? existingDelegateOwner : selectedDelegateOwner;
  const rewardsTokensToDisplay = hasPositions ? existingRewardContractTokens : selectedRewardContractTokens;
  const vaultToDisplay = hasPositions ? existingVault : updatedVault;
  const isRiskLevelUpdated =
    hasPositions && isUpdatedValue(existingVault?.riskLevel, updatedVault?.riskLevel);

  const { data: exitFee } = useSealExitFee();

  const existingCollateralAmount =
    displayToken === mkr
      ? existingVault?.collateralAmount || 0n
      : math.calculateConversion(mkr, existingVault?.collateralAmount || 0n, 0n);
  const updatedCollateralAmount =
    displayToken === mkr
      ? updatedVault?.collateralAmount || 0n
      : math.calculateConversion(mkr, updatedVault?.collateralAmount || 0n, 0n);

  const existingLiquidationPrice =
    displayToken === mkr
      ? existingVault?.liquidationPrice || 0n
      : math.calculateMKRtoSKYPrice(existingVault?.liquidationPrice || 0n, 0n);
  const updatedLiquidationPrice =
    displayToken === mkr
      ? updatedVault?.liquidationPrice || 0n
      : math.calculateMKRtoSKYPrice(updatedVault?.liquidationPrice || 0n, 0n);

  const { data: collateralData } = useCollateralData();

  const lineItems = useMemo(() => {
    return [
      {
        label: t`Exit fee`,
        updated: hasPositions && (mkrToFree > 0n || skyToFree > 0n),
        value:
          hasPositions && (mkrToFree > 0n || skyToFree > 0n) && typeof exitFee === 'bigint'
            ? [
                `${Number(formatUnits((displayToken === mkr ? mkrToFree : math.calculateConversion(mkr, mkrToFree, 0n)) * exitFee, WAD_PRECISION * 2)).toFixed(2)} ${displayToken.symbol}`
              ]
            : '',
        icon: <TokenIcon token={displayToken} className="h-5 w-5" />
      },
      {
        label: getSealLabel(existingVault?.collateralAmount, updatedVault?.collateralAmount),
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
        label: getBorrowLabel(existingVault?.debtValue, updatedVault?.debtValue),
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
                formatPercent(existingVault?.collateralizationRatio || 0n),
                formatPercent(updatedVault?.collateralizationRatio || 0n)
              ]
            : hasPositions
              ? formatPercent(existingVault?.collateralizationRatio || 0n)
              : formatPercent(updatedVault?.collateralizationRatio || 0n),
        tooltipText: getTooltipById('collateralization-ratio-seal')?.tooltip || '',
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
        tooltipText: getTooltipById('borrow-rate-seal')?.tooltip || ''
      },
      {
        label: t`Current ${displayToken.symbol} price`,
        value: `$${formatBigInt(displayToken === mkr ? updatedVault?.delayedPrice || 0n : math.calculateMKRtoSKYPrice(updatedVault?.delayedPrice || 0n, 0n), { unit: WAD_PRECISION })}`
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
        tooltipText:
          getTooltipById(
            displayToken === TOKENS.mkr ? 'liquidation-price-seal-mkr' : 'liquidation-price-seal-sky'
          )?.tooltip || '',
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
        tooltipText: getTooltipById('risk-level-seal')?.tooltip || '',
        hideIfNoDebt: true
      },
      {
        label: t`Seal reward`,
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
                <Skeleton className="w-30 h-5" />
              ) : existingRewardContractTokens ? (
                <TokenIcon token={existingRewardContractTokens?.rewardsToken} className="h-5 w-5" />
              ) : null,
              isSelectedContractTokensLoading ? (
                <Skeleton className="w-30 h-5" />
              ) : selectedRewardContractTokens ? (
                <TokenIcon token={selectedRewardContractTokens?.rewardsToken} className="h-5 w-5" />
              ) : null
            ]
          ) : isRewardContractTokensLoading ? (
            <Skeleton className="w-30 h-5" />
          ) : rewardsTokensToDisplay ? (
            <TokenIcon token={rewardsTokensToDisplay?.rewardsToken} className="h-5 w-5" />
          ) : null
      },
      {
        label: t`Delegate`,
        updated:
          hasPositions && existingSelectedVoteDelegate?.toLowerCase() !== selectedDelegate?.toLowerCase(),
        value:
          hasPositions && existingSelectedVoteDelegate?.toLowerCase() !== selectedDelegate?.toLowerCase()
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
          existingSelectedVoteDelegate?.toLowerCase() !== selectedDelegate.toLowerCase() ? (
            [
              loadingExistingDelegateOwner ? (
                <Skeleton className="w-30 h-5" />
              ) : existingDelegateOwner ? (
                <JazziconComponent address={existingDelegateOwner} diameter={20} />
              ) : null,
              loadingSelectedDelegateOwner ? (
                <Skeleton className="w-30 h-5" />
              ) : selectedDelegateOwner ? (
                <JazziconComponent address={selectedDelegateOwner} diameter={20} />
              ) : null
            ]
          ) : isDelegateLoading ? (
            <Skeleton className="w-30 h-5" />
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
    displayToken,
    exitFee
  ]);

  // If there's no borrowing, filter out items related to it
  const lineItemsFiltered =
    (existingVault?.debtValue === 0n || existingVault?.debtValue === undefined) &&
    (updatedVault?.debtValue === 0n || updatedVault?.debtValue === undefined)
      ? lineItems.filter(item => !item.hideIfNoDebt)
      : lineItems;
  const lineItemsUpdated = lineItemsFiltered.filter(item => item.updated);

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
            <motion.div key="overview" variants={positionAnimations}>
              <Text variant="medium" className="mb-1 font-medium">
                Position overview
              </Text>
              {lineItemsFiltered
                .filter(item => !item.updated && !!item.value)
                .map(({ label, value, icon, className, tooltipText }) => {
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
            {hasPositions && lineItemsUpdated.length > 0 && (
              <motion.div key="updates" variants={positionAnimations}>
                <Text variant="medium" className="mb-1 font-medium">
                  Position changes
                </Text>
                {lineItemsUpdated.map(({ label, value, icon, className, tooltipText }) => {
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
            )}
          </MotionVStack>
        </CardContent>
      </Card>
    </motion.div>
  );
};
