import { useMemo, useState } from 'react';
import { Vault } from '@/hooks';

type UseStakeRiskSliderProps = {
  vault?: Vault;
  existingVault?: Vault;
  vaultNoBorrow?: Vault;
  isRepayMode?: boolean;
  usdsToBorrow: bigint;
  setUsdsToBorrow: (amount: bigint) => void;
  usdsToWipe: bigint;
  setUsdsToWipe: (amount: bigint) => void;
};

/**
 * Copied from `widgets/StakeModuleWidget/hooks/useRiskSlider.ts` (do not
 * import from the widget). Two deliberate changes from the legacy hook: the
 * seam — the four widget-context reads/writes
 * (`usdsToBorrow`/`setUsdsToBorrow`/`usdsToWipe`/`setUsdsToWipe`) arrive as
 * explicit params so the takeover and manage sheet drive them from their own
 * local state — and the no-existing-debt branch clamps to the OSM-capped max
 * (the legacy branch could stage the uncapped market-price max, an amount the
 * protocol's safety price rejects at submit). All other math, gating and sync
 * effects are unchanged.
 */
export const useStakeRiskSlider = ({
  vault,
  existingVault,
  vaultNoBorrow,
  isRepayMode = false,
  usdsToBorrow,
  setUsdsToBorrow,
  usdsToWipe,
  setUsdsToWipe
}: UseStakeRiskSliderProps) => {
  const setValue = isRepayMode ? setUsdsToWipe : setUsdsToBorrow;

  const riskPercentage = vault?.liquidationProximityPercentage || 0;
  const riskPercentageNoBorrow = vaultNoBorrow?.liquidationProximityPercentage || 0;
  const hasExistingDebt = (existingVault?.debtValue || 0n) > 0n;

  // Helper to round to whole USDS (18 decimals)
  const roundToWholeUsds = (amount: bigint): bigint => {
    const USDS_DECIMALS = 10n ** 18n;
    return (amount / USDS_DECIMALS) * USDS_DECIMALS;
  };

  // The risk floor (borrow mode: can't drag left past it) and ceiling (repay
  // mode: can't drag right past it) are the risk level before this action's
  // amount. They follow the collateral (via riskPercentageNoBorrow from
  // vaultNoBorrow) and hold their last value through a refetch gap, so they
  // are state adjusted during render rather than derived.
  const [initialRiskFloor, setInitialRiskFloor] = useState<number | undefined>();
  const [initialRiskCeiling, setInitialRiskCeiling] = useState<number | undefined>();
  const anchorKnown = hasExistingDebt && !!vaultNoBorrow;
  if (!isRepayMode && anchorKnown && initialRiskFloor !== riskPercentageNoBorrow) {
    setInitialRiskFloor(riskPercentageNoBorrow);
  }
  if (isRepayMode && anchorKnown && initialRiskCeiling !== riskPercentageNoBorrow) {
    setInitialRiskCeiling(riskPercentageNoBorrow);
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
      // No existing debt: same OSM-cap clamp as the existing-debt branch —
      // maxBorrowable here is the uncapped (market-price) max, and staging
      // beyond the capped amount produces a transaction the protocol's own
      // safety price rejects. Below the cap, the legacy mapping (whole-USDS
      // rounding, exact unrounded max at 100%) is unchanged.
      const newValue = value === 0 ? 0n : (maxBorrowable * BigInt(value)) / 100n;
      const cappedAmount = vault?.maxSafeBorrowableIntAmount;
      if (cappedAmount && newValue > cappedAmount) {
        setValue(cappedAmount);
      } else {
        setValue(newValue < maxValue ? roundToWholeUsds(newValue) : maxValue);
      }
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

  // Calculate cap percentage based on capped vs uncapped max borrowable
  const capPercentage = useMemo(() => {
    if (isRepayMode) return undefined;

    const maxBorrowableCapped = vault?.maxSafeBorrowableIntAmount || 0n;
    const maxBorrowableUncapped = vault?.maxSafeBorrowableIntAmountNoCap || 0n;
    const existingDebtValue = vaultNoBorrow?.debtValue || 0n;

    if (maxBorrowableUncapped === 0n) return undefined;

    // Cap percentage represents where the debt ceiling limit is on the slider
    // If capped < uncapped, there's a ceiling
    if (maxBorrowableCapped < maxBorrowableUncapped) {
      const ratio =
        Number(
          ((maxBorrowableCapped + existingDebtValue) * 10000n) / (maxBorrowableUncapped + existingDebtValue)
        ) / 100;
      return ratio;
    }

    return undefined;
  }, [vault?.maxSafeBorrowableIntAmount, vault?.maxSafeBorrowableIntAmountNoCap, isRepayMode, vaultNoBorrow]);

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

  // The slider position follows the staged amount (two-way sync through
  // calculatedSliderPosition) or, before an anchor exists, the vault's own
  // risk; in borrow mode the debt ceiling caps it.
  const sliderValue = useMemo(() => {
    if (isRepayMode) {
      return [calculatedSliderPosition ?? riskPercentageNoBorrow];
    }
    const position = calculatedSliderPosition ?? riskPercentage;
    return [capPercentage !== undefined && position > capPercentage ? capPercentage : position];
  }, [isRepayMode, calculatedSliderPosition, riskPercentageNoBorrow, riskPercentage, capPercentage]);

  return {
    sliderValue,
    handleSliderChange,
    shouldShowSlider,
    currentRiskFloor: initialRiskFloor,
    currentRiskCeiling: initialRiskCeiling,
    capPercentage
  };
};
