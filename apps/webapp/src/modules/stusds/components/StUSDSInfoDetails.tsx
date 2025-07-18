import { StUSDSVariableRateCard } from './StUSDSVariableRateCard';
import { StUSDSUtilizationCard } from './StUSDSUtilizationCard';
import { StUSDSTvlCard } from './StUSDSTvlCard';

export function StUSDSInfoDetails() {
  return (
    <div className="flex w-full flex-wrap justify-between gap-3 xl:flex-nowrap">
      <StUSDSVariableRateCard />
      <StUSDSUtilizationCard />
      <StUSDSTvlCard />
    </div>
  );
}
