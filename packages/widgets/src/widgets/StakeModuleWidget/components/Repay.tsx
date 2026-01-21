import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import {
  getIlkName,
  getTokenDecimals,
  RiskLevel,
  TOKENS,
  useCollateralData,
  useSimulatedVault,
  useTokenBalance,
  useVault,
  Vault,
  useSkyPrice
} from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect, useMemo, useCallback } from 'react';
import { StakeModuleWidgetContext } from '../context/context';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Info } from '@widgets/shared/components/icons/Info';
import {
  WAD_PRECISION,
  capitalizeFirstLetter,
  formatBigInt,
  formatBigIntAsCeiledAbsoluteWithSymbol,
  formatPercent,
  useDebounce
} from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { RiskSlider } from '@widgets/shared/components/ui/RiskSlider';
import { getRiskTextColor } from '../lib/utils';
import { useConnection, useChainId } from 'wagmi';
import { useRiskSlider } from '../hooks/useRiskSlider';
import { getTooltipById } from '../../../data/tooltips';
import { DelegateCheckbox } from './DelegateCheckbox';

const { usds } = TOKENS;

const { LOW } = RiskLevel;

const SliderContainer = ({
  vault,
  existingVault,
  vaultNoBorrow
}: {
  vault?: Vault;
  existingVault?: Vault;
  vaultNoBorrow?: Vault;
}) => {
  const { sliderValue, handleSliderChange, shouldShowSlider, currentRiskCeiling } = useRiskSlider({
    vault,
    existingVault,
    vaultNoBorrow,
    isRepayMode: true
  });

  return shouldShowSlider ? (
    <RiskSlider
      value={sliderValue}
      max={100}
      leftLabel={t`Low risk`}
      rightLabel={t`High risk`}
      onValueCommit={(v: number[]) => {
        handleSliderChange(v[0]);
      }}
      liquidationLabel={t`Liquidation`}
      sliderLabel={t`Liquidation risk meter`}
      currentRiskCeiling={currentRiskCeiling}
    />
  ) : null;
};

const PositionManagerOverviewContainer = ({
  simulatedVault,
  existingVault,
  minDebtNotMet
}: {
  simulatedVault?: Vault;
  existingVault?: Vault;
  minDebtNotMet: boolean;
}) => {
  const chainId = useChainId();
  const { data: collateralData } = useCollateralData(getIlkName(2));
  const hasPositions = !!existingVault;

  // New amount values here will factor in user input, if there is no existing vault then amounts will not be included
  const newCollateralAmount = simulatedVault?.collateralAmount || 0n;
  const existingColAmount = existingVault?.collateralAmount || 0n;

  const newBorrowAmount = simulatedVault?.debtValue || 0n;
  const existingBorrowAmount = existingVault?.debtValue || 0n;

  const newColRatio = `${(
    Number(formatUnits(simulatedVault?.collateralizationRatio || 0n, WAD_PRECISION)) * 100
  ).toFixed(2)}%`;
  const existingColRatio = `${(
    Number(formatUnits(existingVault?.collateralizationRatio || 0n, WAD_PRECISION)) * 100
  ).toFixed(2)}%`;

  const newLiqPrice = `$${formatBigInt(simulatedVault?.liquidationPrice || 0n, {
    unit: WAD_PRECISION
  })}`;
  const existingLiqPrice = `$${formatBigInt(existingVault?.liquidationPrice || 0n, {
    unit: WAD_PRECISION
  })}`;

  const existingRiskLevel = existingVault?.riskLevel || LOW;
  const riskLevel = simulatedVault?.riskLevel || LOW;
  const riskTextColor = getRiskTextColor(riskLevel);
  const existingRiskTextColor = getRiskTextColor(existingRiskLevel);

  // If user has already borrowed at least the dust, then there is no minimum
  const formattedMinBorrowable = `${formatBigInt(minDebtNotMet ? simulatedVault?.dust || 0n : 0n, {
    unit: getTokenDecimals(usds, chainId),
    compact: true
  })} ${usds.symbol}`;

  const formattedExistingMaxBorrowable = `${formatBigInt(existingVault?.maxSafeBorrowableIntAmount || 0n, {
    unit: getTokenDecimals(usds, chainId),
    compact: true
  })} ${usds.symbol}`;
  const formatterSimulatedMaxBorrowable = `${formatBigInt(simulatedVault?.maxSafeBorrowableIntAmount || 0n, {
    unit: getTokenDecimals(usds, chainId),
    compact: true
  })} ${usds.symbol}`;

  const formattedMaxBorrowable =
    hasPositions && existingVault?.maxSafeBorrowableIntAmount !== simulatedVault?.maxSafeBorrowableIntAmount
      ? [formattedExistingMaxBorrowable, formatterSimulatedMaxBorrowable]
      : formatterSimulatedMaxBorrowable;

  const { data: skyMarketPrice } = useSkyPrice();

  const initialTxData = useMemo(
    () =>
      [
        {
          label: t`Staking`,
          value:
            hasPositions && newCollateralAmount !== existingColAmount
              ? [
                  `${formatBigInt(existingColAmount, { compact: true })}  SKY`,
                  `${formatBigInt(newCollateralAmount, { compact: true })}  SKY`
                ]
              : `${formatBigInt(newCollateralAmount, { compact: true })}  SKY`
        },
        {
          label: t`Borrowing`,
          value:
            hasPositions && newBorrowAmount !== existingBorrowAmount
              ? [
                  `${formatBigInt(existingBorrowAmount, { compact: true })}  ${usds.symbol}`,
                  `${formatBigInt(newBorrowAmount, { compact: true })}  ${usds.symbol}`
                ]
              : `${formatBigInt(newBorrowAmount, { compact: true })}  ${usds.symbol}`,
          tooltipTitle: getTooltipById('borrow')?.title || '',
          tooltipText: getTooltipById('borrow')?.tooltip || ''
        },
        minDebtNotMet
          ? []
          : [
              {
                label: t`Min borrowable amount`,
                value: formattedMinBorrowable
              },
              {
                label: t`Max borrowable amount`,
                value: formattedMaxBorrowable,
                tooltipTitle: getTooltipById('borrow-limit')?.title || '',
                tooltipText: getTooltipById('borrow-limit')?.tooltip || ''
              }
            ],
        {
          label: t`SKY price`,
          value:
            skyMarketPrice !== undefined
              ? `$${formatBigInt(skyMarketPrice, { unit: WAD_PRECISION })}`
              : t`Not available`
        },
        {
          label: t`Capped OSM SKY price`,
          value: `$${formatBigInt(simulatedVault?.delayedPrice || 0n, { unit: WAD_PRECISION })}`,
          tooltipTitle: getTooltipById('capped-osm-sky-price')?.title || '',
          tooltipText: getTooltipById('capped-osm-sky-price')?.tooltip || ''
        }
      ].flat(),
    [
      hasPositions,
      newCollateralAmount,
      existingColAmount,
      newBorrowAmount,
      existingBorrowAmount,
      minDebtNotMet,
      simulatedVault?.delayedPrice,
      formattedMinBorrowable,
      formattedMaxBorrowable,
      skyMarketPrice
    ]
  );

  const txData = useMemo(
    () => [
      {
        label: t`Borrow Rate`,
        value: collateralData?.stabilityFee ? formatPercent(collateralData?.stabilityFee) : '',
        tooltipTitle: getTooltipById('borrow-rate')?.title || '',
        tooltipText: getTooltipById('borrow-rate')?.tooltip || ''
      },
      {
        label: t`Collateral value`,
        value:
          hasPositions && existingVault?.collateralValue !== simulatedVault?.collateralValue
            ? [
                `$${formatBigInt(existingVault?.collateralValue || 0n, { compact: true })}`,
                `$${formatBigInt(simulatedVault?.collateralValue || 0n, { compact: true })}`
              ]
            : `$${formatBigInt(simulatedVault?.collateralValue || 0n, { compact: true })}`
      },
      {
        label: t`Liquidation price`,
        value:
          hasPositions && existingLiqPrice !== newLiqPrice ? [existingLiqPrice, newLiqPrice] : newLiqPrice,
        tooltipTitle: getTooltipById('liquidation-price')?.title || '',
        tooltipText: getTooltipById('liquidation-price')?.tooltip || ''
      },
      {
        label: t`Collateralization ratio`,
        value:
          hasPositions && existingColRatio !== newColRatio ? [existingColRatio, newColRatio] : newColRatio,
        tooltipTitle: getTooltipById('collateralization-ratio')?.title || '',
        tooltipText: getTooltipById('collateralization-ratio')?.tooltip || ''
      },
      {
        label: t`Liquidation ratio`,
        value: `${formatBigInt((simulatedVault?.liquidationRatio || 0n) * 100n, { unit: 'ray' })}%`
      },
      {
        label: t`Risk level`,
        value:
          hasPositions && simulatedVault?.riskLevel !== existingVault?.riskLevel
            ? [
                `${capitalizeFirstLetter(existingVault?.riskLevel?.toLowerCase() || '')}`,
                `${capitalizeFirstLetter(simulatedVault?.riskLevel?.toLowerCase() || '')}`
              ]
            : `${capitalizeFirstLetter(simulatedVault?.riskLevel?.toLowerCase() || '')}`,
        tooltipTitle: getTooltipById('risk-level')?.title || '',
        tooltipText: getTooltipById('risk-level')?.tooltip || '',
        classNamePrev: existingRiskTextColor,
        className: riskTextColor
      }
    ],
    [
      hasPositions,
      existingLiqPrice,
      newLiqPrice,
      existingColRatio,
      newColRatio,
      simulatedVault?.liquidationProximityPercentage,
      simulatedVault?.riskLevel,
      riskTextColor,
      existingVault?.liquidationProximityPercentage,
      existingVault?.riskLevel,
      existingVault?.collateralValue,
      simulatedVault?.collateralValue,
      existingRiskTextColor,
      collateralData?.stabilityFee
    ]
  );

  return (
    <TransactionOverview
      title={t`Position overview`}
      isFetching={!simulatedVault}
      fetchingMessage={t`Fetching position details`}
      transactionData={[...initialTxData, ...(newBorrowAmount > 0n ? txData : [])]}
    />
  );
};

export const Repay = ({ isConnectedAndEnabled }: { isConnectedAndEnabled: boolean }) => {
  const { address } = useConnection();
  const chainId = useChainId();
  const ilkName = getIlkName(2);

  const { data: usdsBalance } = useTokenBalance({ address, token: TOKENS.usds.address[chainId], chainId });

  const { setIsBorrowCompleted, usdsToWipe, setUsdsToWipe, setWipeAll, activeUrn, skyToFree } =
    useContext(StakeModuleWidgetContext);

  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);
  // Comes from user input amount
  const debouncedUsdsToWipe = useDebounce(usdsToWipe);

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newDebtValue = (existingVault?.debtValue || 0n) - debouncedUsdsToWipe;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const newCollateralAmount = (existingVault?.collateralAmount || 0n) - skyToFree;

  const {
    data: simulatedVault,
    isLoading,
    error
  } = useSimulatedVault(
    // Collateral amounts must be > 0
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    newDebtValue > 0n ? newDebtValue : 0n,
    existingVault?.debtValue || 0n,
    ilkName
  );

  // Simulate a new vault using only the existing debt value (not taking into account new debt)
  // to be able to calculate risk floor and ceiling values
  const { data: simulatedVaultNoBorrow } = useSimulatedVault(
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    existingVault?.debtValue || 0n,
    existingVault?.debtValue || 0n,
    ilkName
  );

  useEffect(() => {
    // Wait for debounced amount
    setIsBorrowCompleted(debouncedUsdsToWipe === usdsToWipe && !error && !isLoading);
  }, [debouncedUsdsToWipe, error, isLoading]);

  const dustDelta = (existingVault?.debtValue || 0n) - (existingVault?.dust || 0n);

  const newBorrowAmount = simulatedVault?.debtValue || 0n;
  const minDebtNotMet = newBorrowAmount > 0n && newBorrowAmount < (existingVault?.dust || 0n);
  const hasEnoughBalance =
    !!usdsBalance?.value && usdsBalance.value > 0n && usdsBalance.value >= debouncedUsdsToWipe;

  const formattedDebtValueWithSymbol = formatBigIntAsCeiledAbsoluteWithSymbol(
    existingVault?.debtValue || 0n,
    getTokenDecimals(usds, chainId),
    usds.symbol
  );

  const errorMsg = minDebtNotMet
    ? t`Debt must be paid off entirely, or left with a minimum of ${formatBigInt(simulatedVault?.dust || 0n)}`
    : !hasEnoughBalance && debouncedUsdsToWipe > 0n
      ? t`Not enough USDS in your wallet`
      : newDebtValue < 0n
        ? t`Amount exceeds debt`
        : debouncedUsdsToWipe > 0n
          ? error?.message
          : undefined;

  const calculateMaxRepayable = useCallback(() => {
    if (!existingVault?.debtValue || !usdsBalance?.value) {
      return 0n;
    }

    const totalDebt = existingVault.debtValue;
    const userBalance = usdsBalance.value;

    if (userBalance >= totalDebt) {
      return totalDebt;
    }

    const remainingDebt = totalDebt - userBalance;

    if (remainingDebt > 0n && remainingDebt < (existingVault.dust || 0n)) {
      const maxRepayWithoutDust = totalDebt - (existingVault.dust || 0n);

      if (userBalance >= maxRepayWithoutDust && maxRepayWithoutDust > 0n) {
        return maxRepayWithoutDust;
      } else {
        return 0n;
      }
    } else {
      return userBalance;
    }
  }, [existingVault?.debtValue, existingVault?.dust, usdsBalance?.value]);

  const maxRepayableAmount = calculateMaxRepayable();

  const formattedLimitAmount = formatBigIntAsCeiledAbsoluteWithSymbol(
    maxRepayableAmount,
    getTokenDecimals(usds, chainId),
    usds.symbol
  );

  const formattedMaxRepay = `${formatBigInt(dustDelta || 0n, {
    unit: getTokenDecimals(usds, chainId)
  })}`;

  const isShowingDustRange = dustDelta > 0n && (usdsBalance?.value || 0n) >= (existingVault?.debtValue || 0n);

  const shouldShowGauge =
    (existingVault?.debtValue || 0n) > 0n &&
    maxRepayableAmount < (usdsBalance?.value || 0n) &&
    !isShowingDustRange;

  const getLimitText = () => {
    if ((existingVault?.debtValue || 0n) <= 0n) {
      return t`You have no debt to repay`;
    }

    if (isShowingDustRange) {
      return `Limit 0 <> ${formattedMaxRepay}, or ${formattedDebtValueWithSymbol}`;
    }

    return formattedLimitAmount;
  };

  const handleSetMax = useCallback(
    (isMax: boolean) => {
      if (!isMax) {
        setWipeAll(false);
        return;
      }

      if (maxRepayableAmount === existingVault?.debtValue && existingVault?.debtValue > 0n) {
        setWipeAll(true);
      } else {
        setWipeAll(false);
      }
    },
    [maxRepayableAmount, existingVault?.debtValue, setWipeAll]
  );

  return (
    <div className="mb-8 space-y-2">
      <TokenInput
        className="mb-4 w-full"
        label={t`How much would you like to repay?`}
        placeholder={t`Enter amount`}
        token={usds}
        tokenList={[usds]}
        balance={maxRepayableAmount}
        limitText={getLimitText()}
        showGauge={shouldShowGauge}
        hideIcon={isShowingDustRange || (existingVault?.debtValue || 0n) <= 0n}
        value={debouncedUsdsToWipe}
        onChange={val => {
          setWipeAll(false);
          setUsdsToWipe(val);
        }}
        dataTestId="repay-input-lse"
        error={errorMsg}
        onSetMax={handleSetMax}
        showPercentageButtons={isConnectedAndEnabled}
        buttonsToShow={[100]}
        enabled={isConnectedAndEnabled}
        disabled={!existingVault?.debtValue}
      />

      {shouldShowGauge ? (
        <div className="mt-2 ml-3 flex items-start text-white">
          <Info height={15} width={16} className="mt-1 shrink-0" />
          <Text variant="small" className="ml-2">
            {t`You cannot repay your full USDS balance of ${formatBigInt(usdsBalance?.value || 0n, {
              unit: getTokenDecimals(usds, chainId)
            })} USDS because doing so would leave less than ${formatBigInt(existingVault?.dust || 0n, {
              unit: getTokenDecimals(usds, chainId)
            })} USDS outstanding.`}
          </Text>
        </div>
      ) : (
        <div className="mb-4" />
      )}

      <SliderContainer
        vault={simulatedVault}
        existingVault={existingVault}
        vaultNoBorrow={simulatedVaultNoBorrow}
      />

      <DelegateCheckbox isVisible={!!simulatedVault} />

      <PositionManagerOverviewContainer
        simulatedVault={simulatedVault}
        existingVault={existingVault}
        minDebtNotMet={minDebtNotMet}
      />
    </div>
  );
};
