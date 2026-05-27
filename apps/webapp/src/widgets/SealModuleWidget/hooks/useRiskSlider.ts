import { useContext, useMemo, useState } from 'react';
import { Vault } from '@/hooks';
import { SealModuleWidgetContext } from '../context/context';

type UseRiskSliderProps = {
  vault?: Vault;
  isRepayMode?: boolean;
};

export const useRiskSlider = ({ vault, isRepayMode = false }: UseRiskSliderProps) => {
  const { setUsdsToWipe } = useContext(SealModuleWidgetContext);
  const setValue = setUsdsToWipe;

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

  // Sync slider position to riskPercentage when it changes. `undefined`
  // sentinel ensures the block runs on mount too (matching useEffect's
  // mount-fire), which can flip the initial Math.max(1, riskPercentage) to
  // the raw riskPercentage (e.g. [1] → [0] when there's no liquidation risk).
  const [prevRiskPercentage, setPrevRiskPercentage] = useState<number | undefined>(undefined);
  if (prevRiskPercentage !== riskPercentage) {
    setPrevRiskPercentage(riskPercentage);
    setSliderValue([riskPercentage]);
  }

  const shouldShowSlider = isRepayMode
    ? true
    : vault?.debtValue && vault?.debtValue > 0n && vault?.collateralAmount && vault?.collateralAmount > 0n;

  return {
    sliderValue,
    handleSliderChange,
    shouldShowSlider
  };
};
