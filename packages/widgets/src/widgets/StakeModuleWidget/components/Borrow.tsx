import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import {
  getIlkName,
  getTokenDecimals,
  RiskLevel,
  TOKENS,
  useCollateralData,
  useSimulatedVault,
  useVault,
  Vault,
  CollateralRiskParameters,
  useSkyPrice
} from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect, useMemo } from 'react';
import { StakeModuleWidgetContext } from '../context/context';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import {
  WAD_PRECISION,
  capitalizeFirstLetter,
  formatBigInt,
  formatPercent,
  useDebounce,
  math
} from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { RiskSlider } from '@widgets/shared/components/ui/RiskSlider';
import { getRiskTextColor, getCeilingTextColor } from '../lib/utils';
import { useChainId } from 'wagmi';
import { useRiskSlider } from '../hooks/useRiskSlider';
import { Text } from '@widgets/shared/components/ui/Typography';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { getTooltipById } from '../../../data/tooltips';
import { Button } from '@widgets/components/ui/button';
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
  const { sliderValue, handleSliderChange, shouldShowSlider, currentRiskFloor, capPercentage } =
    useRiskSlider({
      vault,
      existingVault,
      vaultNoBorrow,
      isRepayMode: false
    });

  return shouldShowSlider ? (
    <RiskSlider
      value={sliderValue}
      max={100}
      leftLabel={t`Low risk`}
      rightLabel={t`High risk`}
      onValueCommit={v => {
        handleSliderChange(v[0]);
      }}
      liquidationLabel={t`Liquidation`}
      sliderLabel={t`Liquidation risk meter`}
      currentRiskFloor={currentRiskFloor}
      capIndicationPercentage={capPercentage}
    />
  ) : null;
};

const PositionManagerOverviewContainer = ({
  simulatedVault,
  existingVault,
  minCollateralNotMet,
  collateralData,
  debouncedUsdsToBorrow
}: {
  simulatedVault?: Vault;
  existingVault?: Vault;
  minCollateralNotMet: boolean;
  collateralData?: CollateralRiskParameters;
  debouncedUsdsToBorrow: bigint;
}) => {
  const chainId = useChainId();
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

  const existingDebtCeilingUtilization = collateralData?.debtCeilingUtilization || 0;
  const newDebtCeilingUtilization = math.debtCeilingUtilization(
    collateralData?.debtCeiling || 0n,
    (collateralData?.totalDaiDebt || 0n) + (debouncedUsdsToBorrow || 0n)
  );
  const newCeilingTextColor = getCeilingTextColor(newDebtCeilingUtilization);
  const existingCeilingRiskTextColor = getCeilingTextColor(existingDebtCeilingUtilization);

  // If user has already borrowed at least the dust, then there is no minimum
  const formattedMinBorrowable = `${formatBigInt(
    (existingVault?.debtValue || 0n) > 0n ? 0n : simulatedVault?.dust || 0n,
    {
      unit: getTokenDecimals(usds, chainId),
      compact: true
    }
  )} ${usds.symbol}`;

  const formattedExistingMaxBorrowable = `${formatBigInt(existingVault?.maxSafeBorrowableIntAmount || 0n, {
    unit: getTokenDecimals(usds, chainId),
    compact: true,
    maxDecimals: 0
  })} ${usds.symbol}`;
  const formatterSimulatedMaxBorrowable = `${formatBigInt(simulatedVault?.maxSafeBorrowableIntAmount || 0n, {
    unit: getTokenDecimals(usds, chainId),
    compact: true,
    maxDecimals: 0
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
                  `${formatBigInt(existingColAmount, { compact: true })} SKY`,
                  `${formatBigInt(newCollateralAmount, { compact: true })} SKY`
                ]
              : `${formatBigInt(newCollateralAmount, { compact: true })} SKY`
        },
        {
          label: t`Borrowing`,
          value:
            hasPositions && newBorrowAmount !== existingBorrowAmount
              ? [
                  `${formatBigInt(existingBorrowAmount, { compact: true })} ${usds.symbol}`,
                  `${formatBigInt(newBorrowAmount, { compact: true })} ${usds.symbol}`
                ]
              : `${formatBigInt(newBorrowAmount, { compact: true })} ${usds.symbol}`,
          tooltipTitle: getTooltipById('borrow')?.title || '',
          tooltipText: getTooltipById('borrow')?.tooltip || ''
        },
        minCollateralNotMet
          ? {
              label: 'Borrow limit',
              value: t`Not enough collateral to borrow`,
              tooltipTitle: getTooltipById('borrow-limit')?.title || '',
              tooltipText: getTooltipById('borrow-limit')?.tooltip || ''
            }
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
      newBorrowAmount,
      newCollateralAmount,
      minCollateralNotMet,
      formattedMaxBorrowable,
      formattedMinBorrowable,
      simulatedVault?.delayedPrice,
      existingColAmount,
      existingBorrowAmount,
      hasPositions,
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
      },
      {
        label: t`Debt ceiling utilization`,
        value:
          hasPositions && existingDebtCeilingUtilization !== newDebtCeilingUtilization
            ? [
                `${Math.ceil(existingDebtCeilingUtilization * 100)}%`,
                `${Math.ceil(newDebtCeilingUtilization * 100)}%`
              ]
            : `${Math.ceil(newDebtCeilingUtilization * 100)}%`,
        tooltipTitle: getTooltipById('debt-ceiling-utilization')?.title || '',
        tooltipText: getTooltipById('debt-ceiling-utilization')?.tooltip || '',
        classNamePrev: existingCeilingRiskTextColor,
        className: newCeilingTextColor
      }
    ],
    [
      existingVault?.collateralValue,
      simulatedVault?.collateralValue,
      existingVault?.liquidationProximityPercentage,
      simulatedVault?.liquidationProximityPercentage,
      hasPositions,
      existingLiqPrice,
      newLiqPrice,
      existingColRatio,
      newColRatio,
      simulatedVault?.riskLevel,
      existingVault?.riskLevel,
      existingRiskTextColor,
      riskTextColor,
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

export const Borrow = ({ isConnectedAndEnabled }: { isConnectedAndEnabled: boolean }) => {
  const { setIsBorrowCompleted, usdsToBorrow, setUsdsToBorrow, activeUrn, skyToLock } =
    useContext(StakeModuleWidgetContext);

  const chainId = useChainId();
  const ilkName = getIlkName(2);

  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);

  // Comes from user input amount
  const debouncedUsdsToBorrow = useDebounce(usdsToBorrow);

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newBorrowAmount = debouncedUsdsToBorrow + (existingVault?.debtValue || 0n);

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const newCollateralAmount = skyToLock + (existingVault?.collateralAmount || 0n);

  const { data: collateralData } = useCollateralData(ilkName);

  const {
    data: simulatedVault,
    isLoading,
    error
  } = useSimulatedVault(newCollateralAmount, newBorrowAmount, existingVault?.debtValue || 0n, ilkName);

  // Simulate a new vault using only the existing debt value (not taking into account new debt)
  // to be able to calculate risk floor and ceiling values
  const { data: simulatedVaultNoBorrow } = useSimulatedVault(
    newCollateralAmount,
    existingVault?.debtValue || 0n,
    existingVault?.debtValue || 0n,
    ilkName
  );

  const minCollateralNotMet =
    simulatedVault?.collateralAmount !== undefined &&
    simulatedVault?.minCollateralForDust !== undefined &&
    simulatedVault.collateralAmount <= simulatedVault.minCollateralForDust;

  // If user has already borrowed at least the dust, then there is no minimum
  const formattedMinBorrowable = `${formatBigInt(
    (existingVault?.debtValue || 0n) > 0n ? 0n : simulatedVault?.dust || 0n,
    {
      unit: getTokenDecimals(usds, chainId)
    }
  )} ${usds.symbol}`;

  //increase total debt by 0.001% to account for future changes to the rate
  const adjustedTotalDebt =
    collateralData?.totalDaiDebt !== undefined ? (collateralData.totalDaiDebt * 100001n) / 100000n : 0n;

  const availableBorrowFromDebtCeiling =
    collateralData?.debtCeiling !== undefined && collateralData?.totalDaiDebt !== undefined
      ? collateralData.debtCeiling - adjustedTotalDebt < 0n
        ? 0n
        : collateralData.debtCeiling - adjustedTotalDebt
      : 0n;

  const availableBorrowFromCollateral = simulatedVault?.maxSafeBorrowableIntAmount ?? 0n;

  const availableBorrowBalance =
    availableBorrowFromDebtCeiling > availableBorrowFromCollateral
      ? availableBorrowFromCollateral
      : availableBorrowFromDebtCeiling;

  const formattedMaxBorrowable = `${formatBigInt(availableBorrowBalance, {
    unit: getTokenDecimals(usds, chainId),
    roundingMode: 'floor'
  })} ${usds.symbol}`;

  useEffect(() => {
    //wait for debouncing to finish
    setIsBorrowCompleted(
      debouncedUsdsToBorrow === usdsToBorrow &&
        !error &&
        !isLoading &&
        //This will allow opening a position without borrowing any USDS
        ((debouncedUsdsToBorrow > 0n && debouncedUsdsToBorrow < availableBorrowFromDebtCeiling) ||
          !debouncedUsdsToBorrow)
    );
  }, [debouncedUsdsToBorrow, usdsToBorrow, error, isLoading, availableBorrowFromDebtCeiling]);

  const errorMsg =
    debouncedUsdsToBorrow > availableBorrowFromDebtCeiling
      ? 'Requested borrow amount exceeds the debt ceiling'
      : minCollateralNotMet
        ? undefined
        : debouncedUsdsToBorrow > 0n
          ? error?.message
          : undefined;

  const inputText =
    collateralData?.debtCeilingUtilization === 1
      ? ''
      : minCollateralNotMet
        ? `Minimum borrow amount is ${formatBigInt(simulatedVault?.dust || 0n, {
            unit: 'wad',
            compact: true
          })} USDS`
        : `Limit ${formattedMinBorrowable.slice(0, -5)} <> ${formattedMaxBorrowable}`;

  const handleMinClick = () => {
    const minAmount = (existingVault?.debtValue || 0n) > 0n ? 0n : simulatedVault?.dust || 0n;
    setUsdsToBorrow(minAmount);
  };

  const showMinButton =
    isConnectedAndEnabled &&
    collateralData?.debtCeilingUtilization !== 1 &&
    !minCollateralNotMet &&
    (existingVault?.debtValue || 0n) === 0n &&
    simulatedVault?.dust &&
    simulatedVault.dust > 0n;

  return (
    <div className="mb-8 space-y-2">
      <TokenInput
        className="mb-4 w-full"
        label={t`How much would you like to borrow? (Optional)`}
        placeholder={t`Enter amount`}
        token={usds}
        tokenList={[usds]}
        balance={availableBorrowBalance}
        limitText={inputText}
        value={debouncedUsdsToBorrow}
        onChange={setUsdsToBorrow}
        dataTestId="borrow-input-lse"
        error={errorMsg}
        showPercentageButtons={false}
        disabled={
          !isConnectedAndEnabled || minCollateralNotMet || collateralData?.debtCeilingUtilization === 1
        }
        enabled={isConnectedAndEnabled}
        hideIcon={isConnectedAndEnabled}
        customActionButtons={
          showMinButton ? (
            <Button size="input" variant="input" onClick={handleMinClick} data-testid="borrow-input-min">
              Min
            </Button>
          ) : undefined
        }
      />
      {collateralData?.debtCeilingUtilization === 1 ? (
        <div className="ml-3 flex items-start text-amber-400">
          <PopoverRateInfo type="dtc" iconClassName="mt-1 shrink-0" />
          <Text variant="small" className="ml-2 flex gap-2">
            Debt ceiling reached. Borrowing USDS is temporarily unavailable.
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
        minCollateralNotMet={minCollateralNotMet}
        collateralData={collateralData}
        debouncedUsdsToBorrow={debouncedUsdsToBorrow}
      />
    </div>
  );
};
