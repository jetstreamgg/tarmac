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
  Vault
} from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useContext, useEffect, useMemo } from 'react';
import { SealModuleWidgetContext } from '../context/context';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import {
  WAD_PRECISION,
  capitalizeFirstLetter,
  formatBigInt,
  formatPercent,
  useDebounce
} from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { RiskSlider } from '@widgets/shared/components/ui/RiskSlider';
import { getRiskTextColor } from '../lib/utils';
import { useConnection, useChainId } from 'wagmi';
import { useSealExitFee } from '@jetstreamgg/sky-hooks';
import { useRiskSlider } from '../hooks/useRiskSlider';
import { getTooltipById } from '../../../data/tooltips';

const { usds, mkr } = TOKENS;

const { LOW } = RiskLevel;

const SliderContainer = ({ vault }: { vault?: Vault }) => {
  const { sliderValue, handleSliderChange } = useRiskSlider({
    vault,
    isRepayMode: true
  });

  return (
    <RiskSlider
      value={sliderValue}
      disabled
      max={100}
      leftLabel={t`Low risk`}
      rightLabel={t`High risk`}
      onValueCommit={(v: number[]) => {
        handleSliderChange(v[0]);
      }}
      liquidationLabel={t`Liquidation`}
      sliderLabel={t`Liquidation risk meter`}
    />
  );
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
  const { data: collateralData } = useCollateralData();
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
    unit: getTokenDecimals(usds, chainId)
  })} ${usds.symbol}`;

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
          label: t`You sealed`,
          value:
            hasPositions && newCollateralAmount !== existingColAmount
              ? [
                  `${formatBigInt(existingColAmount)} ${mkr.symbol}`,
                  `${formatBigInt(newCollateralAmount)} ${mkr.symbol}`
                ]
              : `${formatBigInt(newCollateralAmount)} ${mkr.symbol}`
        },
        {
          label: t`Exit fee`,
          value:
            hasPositions && typeof exitFee === 'bigint'
              ? (() => {
                  // Clamp the freed amount to non-negative before applying exit fee
                  const freedAmount =
                    existingColAmount > newCollateralAmount ? existingColAmount - newCollateralAmount : 0n;
                  return [
                    `${formatBigInt(freedAmount * exitFee, {
                      unit: WAD_PRECISION * 2
                    })} ${mkr.symbol}`
                  ];
                })()
              : ''
        },
        {
          label: t`Exit fee percentage`,
          value:
            hasPositions && typeof exitFee === 'bigint'
              ? [`${Number(formatUnits(exitFee * 100n, WAD_PRECISION)).toFixed(2)}%`]
              : ''
        },
        {
          label: t`You borrowed`,
          value:
            hasPositions && newBorrowAmount !== existingBorrowAmount
              ? [
                  `${formatBigInt(existingBorrowAmount)}  ${usds.symbol}`,
                  `${formatBigInt(newBorrowAmount)}  ${usds.symbol}`
                ]
              : `${formatBigInt(newBorrowAmount)}  ${usds.symbol}`,
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
                tooltipText: getTooltipById('borrow-limit')?.tooltip || ''
              }
            ],
        {
          label: t`Current ${mkr.symbol} price`,
          value: `$${formatBigInt(simulatedVault?.delayedPrice || 0n, { unit: WAD_PRECISION })}`
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
      exitFee
    ]
  );

  const txData = useMemo(
    () => [
      {
        label: t`Borrow Rate`,
        value: collateralData?.stabilityFee ? formatPercent(collateralData?.stabilityFee) : '',
        tooltipText: getTooltipById('borrow-rate-seal')?.tooltip || ''
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
        tooltipText: getTooltipById('liquidation-price-seal-mkr')?.tooltip || ''
      },
      {
        label: t`Collateralization ratio`,
        value:
          hasPositions && existingColRatio !== newColRatio ? [existingColRatio, newColRatio] : newColRatio,
        tooltipText: getTooltipById('collateralization-ratio-seal')?.tooltip || ''
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
        tooltipText: getTooltipById('risk-level-seal')?.tooltip || '',
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
  const ilkName = getIlkName(1);

  const { data: usdsBalance } = useTokenBalance({ address, token: TOKENS.usds.address[chainId], chainId });

  const { setIsBorrowCompleted, usdsToWipe, setUsdsToWipe, setWipeAll, mkrToFree, activeUrn } =
    useContext(SealModuleWidgetContext);

  const { data: existingVault } = useVault(activeUrn?.urnAddress, ilkName);
  // Comes from user input amount
  const debouncedUsdsToWipe = useDebounce(usdsToWipe);

  // Calculated total amount user will have borrowed based on existing debt plus the user input
  const newDebtValue = (existingVault?.debtValue || 0n) - debouncedUsdsToWipe;

  // Calculated total amount user will have locked based on existing collateral locked plus user input
  const newCollateralAmount = (existingVault?.collateralAmount || 0n) - mkrToFree;

  const {
    data: simulatedVault,
    isLoading,
    error
  } = useSimulatedVault(
    // Collateral amounts must be > 0
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    newDebtValue > 0n ? newDebtValue : 0n,
    existingVault?.debtValue || 0n
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

  // The most you can repay is your dust delta, or your full debt
  const formattedMaxRepay = `${formatBigInt(dustDelta || 0n, {
    unit: getTokenDecimals(usds, chainId)
  })}`;

  const formattedDebtValue = `${formatBigInt(existingVault?.debtValue || 0n, {
    unit: getTokenDecimals(usds, chainId)
  })} ${usds.symbol}`;

  const errorMsg = minDebtNotMet
    ? t`Debt must be paid off entirely, or left with a minimum of ${formatBigInt(simulatedVault?.dust || 0n)}`
    : !hasEnoughBalance && debouncedUsdsToWipe > 0n
      ? t`Not enough USDS in your wallet`
      : newDebtValue < 0n
        ? t`Amount exceeds debt`
        : debouncedUsdsToWipe > 0n
          ? error?.message
          : undefined;

  return (
    <div className="mb-8 space-y-2">
      <TokenInput
        className="mb-8 w-full"
        label={t`How much would you like to repay?`}
        placeholder={t`Enter amount`}
        token={usds}
        tokenList={[usds]}
        balance={existingVault?.debtValue}
        limitText={
          (existingVault?.debtValue || 0n) <= 0n
            ? t`You have no debt to repay`
            : dustDelta > 0n
              ? `Limit 0 <> ${formattedMaxRepay}, or ${formattedDebtValue}`
              : formattedDebtValue
        }
        value={debouncedUsdsToWipe}
        onChange={val => {
          setWipeAll(false);
          setUsdsToWipe(val);
        }}
        dataTestId="repay-input-lse"
        error={errorMsg}
        onSetMax={setWipeAll}
        showPercentageButtons={isConnectedAndEnabled}
        buttonsToShow={[100]}
        enabled={isConnectedAndEnabled}
        disabled={!existingVault?.debtValue}
      />
      <SliderContainer vault={simulatedVault} />

      <PositionManagerOverviewContainer
        simulatedVault={simulatedVault}
        existingVault={existingVault}
        minDebtNotMet={minDebtNotMet}
      />
    </div>
  );
};
