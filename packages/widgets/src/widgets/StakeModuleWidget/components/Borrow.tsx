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
  useSealExitFee
} from '@jetstreamgg/hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect, useMemo } from 'react';
import { StakeModuleWidgetContext } from '../context/context';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import {
  WAD_PRECISION,
  captitalizeFirstLetter,
  formatBigInt,
  formatPercent,
  useDebounce,
  math
} from '@jetstreamgg/utils';
import { formatUnits } from 'viem';
import { RiskSlider } from '@widgets/shared/components/ui/RiskSlider';
import { getRiskTextColor, getCeilingTextColor } from '../lib/utils';
import { useChainId } from 'wagmi';
import { useRiskSlider } from '../hooks/useRiskSlider';
import {
  collateralizationRatioTooltipText,
  liquidationPriceTooltipText,
  riskLevelTooltipText,
  borrowRateTooltipText,
  debtCeilingTooltipText
} from '../lib/constants';
import { Text } from '@widgets/shared/components/ui/Typography';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';

const { usds } = TOKENS;

const { LOW } = RiskLevel;

const SliderContainer = ({ vault }: { vault?: Vault }) => {
  const { sliderValue, handleSliderChange, shouldShowSlider } = useRiskSlider({
    vault,
    isRepayMode: false
  });

  return shouldShowSlider ? (
    <RiskSlider
      value={sliderValue}
      max={100}
      leftLabel={t`Low risk`}
      rightLabel={t`High risk`}
      disabled={true}
      onValueCommit={v => {
        handleSliderChange(v[0]);
      }}
      liquidationLabel={t`Liquidation`}
      sliderLabel={t`Liquidation risk meter`}
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
      unit: getTokenDecimals(usds, chainId)
    }
  )} ${usds.symbol}`;

  const formattedExistingMaxBorrowable = `${formatBigInt(existingVault?.maxSafeBorrowableIntAmount || 0n, {
    unit: getTokenDecimals(usds, chainId)
  })} ${usds.symbol}`;
  const formatterSimulatedMaxBorrowable = `${formatBigInt(simulatedVault?.maxSafeBorrowableIntAmount || 0n, {
    unit: getTokenDecimals(usds, chainId)
  })} ${usds.symbol}`;

  const formattedMaxBorrowable =
    hasPositions && existingVault?.maxSafeBorrowableIntAmount !== simulatedVault?.maxSafeBorrowableIntAmount
      ? [formattedExistingMaxBorrowable, formatterSimulatedMaxBorrowable]
      : formatterSimulatedMaxBorrowable;

  const { data: exitFee } = useSealExitFee();

  const initialTxData = useMemo(
    () =>
      [
        {
          label: t`You staked`,
          value:
            hasPositions && newCollateralAmount !== existingColAmount
              ? [`${formatBigInt(existingColAmount)} SKY`, `${formatBigInt(newCollateralAmount)} SKY`]
              : `${formatBigInt(newCollateralAmount)} SKY`
        },
        {
          label: t`You borrowed`,
          value:
            hasPositions && newBorrowAmount !== existingBorrowAmount
              ? [
                  `${formatBigInt(existingBorrowAmount)} ${usds.symbol}`,
                  `${formatBigInt(newBorrowAmount)} ${usds.symbol}`
                ]
              : `${formatBigInt(newBorrowAmount)} ${usds.symbol}`
        },
        minCollateralNotMet
          ? { label: 'Borrow limit', value: t`Not enough collateral to borrow` }
          : [
              {
                label: t`Min borrowable amount`,
                value: formattedMinBorrowable
              },
              {
                label: t`Max borrowable amount`,
                value: formattedMaxBorrowable
              }
            ],
        {
          label: t`Current SKY price`,
          value: `$${formatBigInt(simulatedVault?.delayedPrice || 0n, { unit: WAD_PRECISION })}`
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
      exitFee
    ]
  );

  const txData = useMemo(
    () => [
      {
        label: t`Borrow rate`,
        value: collateralData?.stabilityFee ? formatPercent(collateralData?.stabilityFee) : '',
        tooltipText: borrowRateTooltipText
      },
      {
        label: t`Collateral value`,
        value:
          hasPositions && existingVault?.collateralValue !== simulatedVault?.collateralValue
            ? [
                `$${formatBigInt(existingVault?.collateralValue || 0n)}`,
                `$${formatBigInt(simulatedVault?.collateralValue || 0n)}`
              ]
            : `$${formatBigInt(simulatedVault?.collateralValue || 0n)}`
      },
      {
        label: t`Liquidation price`,
        value:
          hasPositions && existingLiqPrice !== newLiqPrice ? [existingLiqPrice, newLiqPrice] : newLiqPrice,
        tooltipText: liquidationPriceTooltipText
      },
      {
        label: t`Collateralization ratio`,
        value:
          hasPositions && existingColRatio !== newColRatio ? [existingColRatio, newColRatio] : newColRatio,
        tooltipText: collateralizationRatioTooltipText
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
                `${captitalizeFirstLetter(existingVault?.riskLevel?.toLowerCase() || '')}`,
                `${captitalizeFirstLetter(simulatedVault?.riskLevel?.toLowerCase() || '')}`
              ]
            : `${captitalizeFirstLetter(simulatedVault?.riskLevel?.toLowerCase() || '')}`,
        tooltipText: riskLevelTooltipText,
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
        tooltipText: debtCeilingTooltipText,
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
  const ilkName = getIlkName(chainId, 2);

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
        ? `You need to stake at least ${simulatedVault?.formattedMinSkyCollateralForDust} SKY to borrow`
        : `Limit ${formattedMinBorrowable.slice(0, -5)} <> ${formattedMaxBorrowable}`;

  return (
    <div className="mb-8 space-y-2">
      <TokenInput
        className="mb-4 w-full"
        label={t`How much would you like to borrow? (Optional)`}
        placeholder={t`Enter amount`}
        token={usds}
        tokenList={[usds]}
        balance={availableBorrowBalance}
        borrowLimitText={inputText}
        value={debouncedUsdsToBorrow}
        onChange={setUsdsToBorrow}
        dataTestId="borrow-input-lse"
        error={errorMsg}
        showPercentageButtons={false}
        disabled={
          !isConnectedAndEnabled || minCollateralNotMet || collateralData?.debtCeilingUtilization === 1
        }
        enabled={isConnectedAndEnabled}
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
      <SliderContainer vault={simulatedVault} />

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
