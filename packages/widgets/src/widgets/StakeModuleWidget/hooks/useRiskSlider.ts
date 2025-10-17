import { useContext, useEffect, useMemo, useState } from 'react';
import { Vault } from '@jetstreamgg/sky-hooks';
import { StakeModuleWidgetContext } from '../context/context';

type UseRiskSliderProps = {
  vault?: Vault;
  isRepayMode?: boolean;
};

export const useRiskSlider = ({ vault, isRepayMode = false }: UseRiskSliderProps) => {
  const { setUsdsToBorrow, setUsdsToWipe } = useContext(StakeModuleWidgetContext);
  const setValue = isRepayMode ? setUsdsToWipe : setUsdsToBorrow;

  const riskPercentage = vault?.liquidationProximityPercentage || 0;
  const hasExistingDebt = (vault?.debtValue || 0n) > 0n;

  const [sliderValue, setSliderValue] = useState([Math.max(1, riskPercentage)]);

  // Capture the initial risk floor for borrow mode (can't drag left past this)
  const [initialRiskFloor, setInitialRiskFloor] = useState<number | undefined>();
  // Capture the initial risk ceiling for repay mode (can't drag right past this)
  const [initialRiskCeiling, setInitialRiskCeiling] = useState<number | undefined>();

  useEffect(() => {
    // Set the initial risk floor only once when we have valid vault data in borrow mode
    if (initialRiskFloor === undefined && vault && !isRepayMode && hasExistingDebt) {
      setInitialRiskFloor(riskPercentage);
    }
    // Set the initial risk ceiling only once when we have valid vault data in repay mode
    if (initialRiskCeiling === undefined && vault && isRepayMode && hasExistingDebt) {
      setInitialRiskCeiling(riskPercentage);
    }
  }, [vault, isRepayMode, hasExistingDebt, riskPercentage, initialRiskFloor, initialRiskCeiling]);

  const [maxBorrowable, maxValue] = useMemo(() => {
    const maxBorrowable = vault?.maxSafeBorrowableIntAmount || 0n;
    const maxValue = maxBorrowable;
    return [maxBorrowable, maxValue];
  }, [vault?.maxSafeBorrowableIntAmount]);

  const handleSliderChange = (value: number) => {
    if (maxBorrowable === 0n) return;
    if (value < 0 || value > 100) {
      console.warn('Slider value out of valid percentage range (0-100)');
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
      setValue(newValue < maxValue ? newValue : maxValue);
    } else if (isRepayMode && initialRiskCeiling !== undefined) {
      // In repay mode, calculate repayment amount from initial risk level to selected value
      // Moving left (lower risk) means repaying more debt
      if (value >= initialRiskCeiling) {
        // Don't allow moving right of initial risk level
        setValue(0n);
        return;
      }
      // Calculate repayment amount from selected value to initial risk level
      const repayPercentage = initialRiskCeiling - value;
      const repayablePercentage = initialRiskCeiling;
      const newValue =
        repayablePercentage > 0
          ? (maxBorrowable * BigInt(Math.round(repayPercentage * 100))) /
            BigInt(Math.round(repayablePercentage * 100))
          : 0n;
      setValue(newValue < maxValue ? newValue : maxValue);
    } else {
      // Original behavior for no existing debt
      const newValue = value === 0 ? 0n : (maxBorrowable * BigInt(value)) / 100n;
      setValue(newValue < maxValue ? newValue : maxValue);
    }
  };

  useEffect(() => {
    setSliderValue([riskPercentage]);
  }, [riskPercentage]);

  const shouldShowSlider = isRepayMode
    ? true
    : vault?.debtValue && vault?.debtValue > 0n && vault?.collateralAmount && vault?.collateralAmount > 0n;

  return {
    sliderValue,
    handleSliderChange,
    shouldShowSlider,
    currentRiskFloor: initialRiskFloor,
    currentRiskCeiling: initialRiskCeiling
  };
};
