import { useContext, useMemo, useState } from 'react';
import { Vault } from '@/hooks';
import { StakeModuleWidgetContext } from '../context/context';

type UseRiskSliderProps = {
  vault?: Vault;
  existingVault?: Vault;
  vaultNoBorrow?: Vault;
  isRepayMode?: boolean;
};

// Pure helper hoisted out of the hook so it doesn't need useMemo to stabilise.
function computeCapPercentage(
  isRepayMode: boolean,
  maxBorrowableCapped: bigint,
  maxBorrowableUncapped: bigint,
  existingDebtValue: bigint
): number | undefined {
  if (isRepayMode) return undefined;
  if (maxBorrowableUncapped === 0n) return undefined;
  if (maxBorrowableCapped < maxBorrowableUncapped) {
    return (
      Number(
        ((maxBorrowableCapped + existingDebtValue) * 10000n) /
          (maxBorrowableUncapped + existingDebtValue)
      ) / 100
    );
  }
  return undefined;
}

export const useRiskSlider = ({
  vault,
  existingVault,
  vaultNoBorrow,
  isRepayMode = false
}: UseRiskSliderProps) => {
  const { setUsdsToBorrow, setUsdsToWipe, usdsToWipe, usdsToBorrow } = useContext(StakeModuleWidgetContext);
  const setValue = isRepayMode ? setUsdsToWipe : setUsdsToBorrow;

  const riskPercentage = vault?.liquidationProximityPercentage || 0;
  const riskPercentageNoBorrow = vaultNoBorrow?.liquidationProximityPercentage || 0;
  const hasExistingDebt = (existingVault?.debtValue || 0n) > 0n;

  // Helper to round to whole USDS (18 decimals)
  const roundToWholeUsds = (amount: bigint): bigint => {
    const USDS_DECIMALS = 10n ** 18n;
    return (amount / USDS_DECIMALS) * USDS_DECIMALS;
  };

  const [sliderValue, setSliderValue] = useState([Math.max(1, riskPercentage)]);

  // Capture the initial risk floor for borrow mode (can't drag left past this)
  const [initialRiskFloor, setInitialRiskFloor] = useState<number | undefined>();
  // Capture the initial risk ceiling for repay mode (can't drag right past this)
  const [initialRiskCeiling, setInitialRiskCeiling] = useState<number | undefined>();

  // Set initial risk floor (borrow mode) or ceiling (repay mode) when we have
  // valid vault data. Render-time tracking with a [null] sentinel so the body
  // runs on mount (matches useEffect mount-fire).
  const [prevRiskDeps, setPrevRiskDeps] = useState<
    | {
        isRepayMode: boolean;
        hasExistingDebt: boolean;
        vaultNoBorrow: typeof vaultNoBorrow;
        riskPercentageNoBorrow: number;
      }
    | null
  >(null);
  if (
    prevRiskDeps === null ||
    prevRiskDeps.isRepayMode !== isRepayMode ||
    prevRiskDeps.hasExistingDebt !== hasExistingDebt ||
    prevRiskDeps.vaultNoBorrow !== vaultNoBorrow ||
    prevRiskDeps.riskPercentageNoBorrow !== riskPercentageNoBorrow
  ) {
    setPrevRiskDeps({ isRepayMode, hasExistingDebt, vaultNoBorrow, riskPercentageNoBorrow });
    if (!isRepayMode && hasExistingDebt && vaultNoBorrow) {
      setInitialRiskFloor(riskPercentageNoBorrow);
    }
    if (isRepayMode && hasExistingDebt && vaultNoBorrow) {
      setInitialRiskCeiling(riskPercentageNoBorrow);
    }
  }

  const [maxBorrowable, maxValue] = useMemo(() => {
    const maxBorrowable = vault?.maxSafeBorrowableIntAmountNoCap || 0n;
    const maxValue = maxBorrowable;
    return [maxBorrowable, maxValue];
  }, [vault?.maxSafeBorrowableIntAmountNoCap]);

  const handleSliderChange = (value: number) => {
    if (!isRepayMode && maxBorrowable === 0n) return;
    if (value < 0 || value > 100) {
      console.warn('Slider value out of valid percentage range (0-100)');
      return;
    }

    // Check if slider is at the cap position - use exact capped amount
    if (!isRepayMode && capPercentage !== undefined && Math.abs(value - capPercentage) < 0.1) {
      const cappedAmount = vault?.maxSafeBorrowableIntAmount || 0n;
      setValue(cappedAmount);
      return;
    }

    // In borrow manage flow (existing debt), treat initial risk level as 0 borrow amount
    // Only allow increasing borrow by moving right from initial position
    if (!isRepayMode && initialRiskFloor !== undefined) {
      if (value <= initialRiskFloor) {
        // Don't allow moving left of initial risk level
        setValue(0n);
        return;
      }
      // Calculate additional borrow amount from initial risk level to selected value
      const additionalBorrowPercentage = value - initialRiskFloor;
      const remainingBorrowablePercentage = 100 - initialRiskFloor;
      const newValue =
        remainingBorrowablePercentage > 0
          ? (maxBorrowable * BigInt(Math.round(additionalBorrowPercentage * 100))) /
            BigInt(Math.round(remainingBorrowablePercentage * 100))
          : 0n;

      // Cap the value at the capped amount if it exists
      const cappedAmount = vault?.maxSafeBorrowableIntAmount;
      const finalValue = cappedAmount && newValue > cappedAmount ? cappedAmount : roundToWholeUsds(newValue);
      setValue(finalValue < maxValue ? finalValue : maxValue);
    } else if (isRepayMode && initialRiskCeiling !== undefined) {
      // In repay mode, calculate repayment amount from initial risk level to selected value
      // Moving left (lower risk) means repaying more debt
      if (value >= initialRiskCeiling) {
        // Don't allow moving right of initial risk level
        setValue(0n);
        return;
      }
      // Calculate repayment amount based on current debt
      const currentDebt = existingVault?.debtValue || 0n;
      if (currentDebt === 0n) {
        setValue(0n);
        return;
      }

      // Calculate repayment amount from selected value to initial risk level
      // repayPercentage represents how much of the ceiling range we're moving left
      const repayPercentage = initialRiskCeiling - value;
      const repayablePercentage = initialRiskCeiling;
      const newValue =
        repayablePercentage > 0
          ? (currentDebt * BigInt(Math.round(repayPercentage * 100))) /
            BigInt(Math.round(repayablePercentage * 100))
          : 0n;
      setValue(repayPercentage === repayablePercentage ? newValue : roundToWholeUsds(newValue));
    } else {
      // Original behavior for no existing debt
      const newValue = value === 0 ? 0n : (maxBorrowable * BigInt(value)) / 100n;
      setValue(newValue < maxValue ? roundToWholeUsds(newValue) : maxValue);
    }
  };

  // Use simulated vault first since it reflects current user input
  const existingOrNewVault = vault || existingVault;

  // Show slider in repay mode if there is existing debt and collateral, even if the simulated debt is 0
  const shouldShowSlider = isRepayMode
    ? hasExistingDebt && !!existingVault?.collateralAmount && existingVault.collateralAmount > 0n
    : !!existingOrNewVault?.debtValue &&
      existingOrNewVault.debtValue > 0n &&
      !!existingOrNewVault?.collateralAmount &&
      existingOrNewVault.collateralAmount > 0n;

  // Calculate cap percentage based on capped vs uncapped max borrowable.
  // No useMemo — compiler auto-memoizes when beneficial; the manual memo was
  // deemed redundant.
  const capPercentage = computeCapPercentage(
    isRepayMode,
    vault?.maxSafeBorrowableIntAmount || 0n,
    vault?.maxSafeBorrowableIntAmountNoCap || 0n,
    vaultNoBorrow?.debtValue || 0n
  );

  // Calculate the correct slider position based on current repay/borrow amount
  // This reverses the calculation in handleSliderChange to maintain two-way sync
  const calculatedSliderPosition = useMemo(() => {
    if (isRepayMode && initialRiskCeiling !== undefined) {
      const currentDebt = existingVault?.debtValue || 0n;
      if (currentDebt === 0n) return initialRiskCeiling;

      // Reverse the repay calculation: value = initialRiskCeiling * (1 - usdsToWipe / currentDebt)
      // Calculate position using only BigInt, then convert final percentage
      const remainingDebtFraction = ((currentDebt - usdsToWipe) * 10000n) / currentDebt;
      return (initialRiskCeiling * Number(remainingDebtFraction)) / 10000;
    } else if (!isRepayMode && initialRiskFloor !== undefined) {
      const maxBorrowable = vault?.maxSafeBorrowableIntAmountNoCap || 0n;
      if (maxBorrowable === 0n) return initialRiskFloor;

      // Reverse the borrow calculation
      const remainingBorrowablePercentage = 100 - initialRiskFloor;
      if (remainingBorrowablePercentage === 0) return initialRiskFloor;

      const borrowedFraction = (usdsToBorrow * 10000n) / maxBorrowable;
      return initialRiskFloor + (remainingBorrowablePercentage * Number(borrowedFraction)) / 10000;
    }
    return undefined;
  }, [
    isRepayMode,
    initialRiskCeiling,
    initialRiskFloor,
    usdsToWipe,
    usdsToBorrow,
    existingVault?.debtValue,
    vault?.maxSafeBorrowableIntAmountNoCap
  ]);

  // Sync slider in borrow mode. Render-time prev-tracking with [null]
  // sentinel — the original useEffect's mount-fire was observable (init
  // sliderValue=[Math.max(1, riskPercentage)] differs from what these
  // branches compute from capPercentage/calculatedSliderPosition).
  const [prevBorrowSyncDeps, setPrevBorrowSyncDeps] = useState<
    | {
        riskPercentage: number;
        capPercentage: number | undefined;
        isRepayMode: boolean;
        calculatedSliderPosition: number | undefined;
      }
    | null
  >(null);
  if (
    prevBorrowSyncDeps === null ||
    prevBorrowSyncDeps.riskPercentage !== riskPercentage ||
    prevBorrowSyncDeps.capPercentage !== capPercentage ||
    prevBorrowSyncDeps.isRepayMode !== isRepayMode ||
    prevBorrowSyncDeps.calculatedSliderPosition !== calculatedSliderPosition
  ) {
    setPrevBorrowSyncDeps({ riskPercentage, capPercentage, isRepayMode, calculatedSliderPosition });
    if (!isRepayMode) {
      if (calculatedSliderPosition !== undefined) {
        if (capPercentage !== undefined && calculatedSliderPosition > capPercentage) {
          setSliderValue([capPercentage]);
        } else {
          setSliderValue([calculatedSliderPosition]);
        }
      } else {
        if (capPercentage !== undefined && riskPercentage > capPercentage) {
          setSliderValue([capPercentage]);
        } else {
          setSliderValue([riskPercentage]);
        }
      }
    }
  }

  // Sync slider in repay mode — same pattern with its own deps. [null]
  // sentinel for mount-fire (init differs from computed position).
  const [prevRepaySyncDeps, setPrevRepaySyncDeps] = useState<
    {
      isRepayMode: boolean;
      calculatedSliderPosition: number | undefined;
      riskPercentageNoBorrow: number;
    } | null
  >(null);
  if (
    prevRepaySyncDeps === null ||
    prevRepaySyncDeps.isRepayMode !== isRepayMode ||
    prevRepaySyncDeps.calculatedSliderPosition !== calculatedSliderPosition ||
    prevRepaySyncDeps.riskPercentageNoBorrow !== riskPercentageNoBorrow
  ) {
    setPrevRepaySyncDeps({ isRepayMode, calculatedSliderPosition, riskPercentageNoBorrow });
    if (isRepayMode) {
      const position =
        calculatedSliderPosition !== undefined ? calculatedSliderPosition : riskPercentageNoBorrow;
      setSliderValue([position]);
    }
  }

  return {
    sliderValue,
    handleSliderChange,
    shouldShowSlider,
    currentRiskFloor: initialRiskFloor,
    currentRiskCeiling: initialRiskCeiling,
    capPercentage
  };
};
