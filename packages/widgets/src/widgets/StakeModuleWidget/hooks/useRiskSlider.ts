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
  const [sliderValue, setSliderValue] = useState([Math.max(1, riskPercentage)]);

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
    const newValue = value === 0 ? 0n : (maxBorrowable * BigInt(value)) / 100n;
    setValue(newValue < maxValue ? newValue : maxValue);
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
    shouldShowSlider
  };
};
