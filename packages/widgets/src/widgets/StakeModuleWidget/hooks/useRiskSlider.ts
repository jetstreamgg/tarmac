import { useContext, useEffect, useMemo, useState } from 'react';
import { Vault } from '@jetstreamgg/sky-hooks';
import { StakeModuleWidgetContext } from '../context/context';

type UseRiskSliderProps = {
  vault?: Vault;
  existingVault?: Vault;
  vaultNoBorrow?: Vault;
  isRepayMode?: boolean;
};

export const useRiskSlider = ({
  vault,
  existingVault,
  vaultNoBorrow,
  isRepayMode = false
}: UseRiskSliderProps) => {
  const { setUsdsToBorrow, setUsdsToWipe } = useContext(StakeModuleWidgetContext);
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

  useEffect(() => {
    // Set the initial risk floor when we have valid vault data in borrow mode
    if (!isRepayMode && hasExistingDebt && vaultNoBorrow) {
      setInitialRiskFloor(riskPercentageNoBorrow);
    }
    // Set the initial risk ceiling when we have valid vault data in repay mode
    if (isRepayMode && hasExistingDebt && vaultNoBorrow) {
      setInitialRiskCeiling(riskPercentageNoBorrow);
    }
  }, [isRepayMode, hasExistingDebt, vaultNoBorrow, riskPercentageNoBorrow]);

  const [maxBorrowable, maxValue] = useMemo(() => {
    const maxBorrowable = vault?.maxSafeBorrowableIntAmountNoCap || 0n;
    const maxValue = maxBorrowable;
    return [maxBorrowable, maxValue];
  }, [vault?.maxSafeBorrowableIntAmountNoCap]);

  const handleSliderChange = (value: number) => {
    if (maxBorrowable === 0n) return;
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

  const existingOrNewVault = existingVault || vault;
  const shouldShowSlider =
    !!existingOrNewVault?.debtValue &&
    existingOrNewVault?.debtValue > 0n &&
    !!existingOrNewVault?.collateralAmount &&
    existingOrNewVault?.collateralAmount > 0n;

  // Calculate cap percentage based on capped vs uncapped max borrowable
  const capPercentage = useMemo(() => {
    if (isRepayMode) return undefined;

    const maxBorrowableCapped = vault?.maxSafeBorrowableIntAmount || 0n;
    const maxBorrowableUncapped = vault?.maxSafeBorrowableIntAmountNoCap || 0n;

    if (maxBorrowableUncapped === 0n) return undefined;

    // Cap percentage represents where the debt ceiling limit is on the slider
    // If capped < uncapped, there's a ceiling
    if (maxBorrowableCapped < maxBorrowableUncapped) {
      const ratio = Number((maxBorrowableCapped * 10000n) / maxBorrowableUncapped) / 100;
      return ratio;
    }

    return undefined;
  }, [vault?.maxSafeBorrowableIntAmount, vault?.maxSafeBorrowableIntAmountNoCap, isRepayMode]);

  useEffect(() => {
    // If we're at or past the cap, clamp the slider to the cap position
    if (capPercentage !== undefined && riskPercentage > capPercentage) {
      setSliderValue([capPercentage]);
    } else {
      setSliderValue([riskPercentage]);
    }
  }, [riskPercentage, capPercentage]);

  return {
    sliderValue,
    handleSliderChange,
    shouldShowSlider,
    currentRiskFloor: initialRiskFloor,
    currentRiskCeiling: initialRiskCeiling,
    capPercentage
  };
};
