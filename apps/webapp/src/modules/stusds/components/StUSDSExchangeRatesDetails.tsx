import { StUSDSNativeExchangeRateCard } from './StUSDSNativeExchangeRateCard';
import { StUSDSCurveExchangeRateCard } from './StUSDSCurveExchangeRateCard';
import { StUSDSRateDifferenceCard } from './StUSDSRateDifferenceCard';

export function StUSDSExchangeRatesDetails() {
  return (
    <div className="flex w-full flex-wrap gap-3">
      <div className="min-w-[300px] flex-1">
        <StUSDSNativeExchangeRateCard />
      </div>
      <div className="min-w-[300px] flex-1">
        <StUSDSCurveExchangeRateCard />
      </div>
      <div className="min-w-[300px] flex-1">
        <StUSDSRateDifferenceCard />
      </div>
    </div>
  );
}
