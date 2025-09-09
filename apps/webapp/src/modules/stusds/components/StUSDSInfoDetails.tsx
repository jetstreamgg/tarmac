import { StUSDSRateCard } from './StUSDSRateCard';
import { StUSDSUtilizationCard } from './StUSDSUtilizationCard';
import { StUSDSTvlCard } from './StUSDSTvlCard';
import { StUSDSLiquidityCard } from './StUSDSLiquidityCard';
import { TotalDebtCard } from './TotalDebtCard';
import { StUSDSCapCard } from './StUSDSCapCard';
import { StUSDSRemainingCapacityCard } from './StUSDSRemainingCapacityCard';
import { StUSDSSuppliersCard } from './StUSDSSuppliersCard';

export function StUSDSInfoDetails() {
  return (
    <div className="flex w-full flex-wrap gap-3">
      <div className="min-w-[250px] flex-1">
        <StUSDSRateCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <StUSDSUtilizationCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <StUSDSCapCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <StUSDSRemainingCapacityCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <StUSDSTvlCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <StUSDSLiquidityCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <TotalDebtCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <StUSDSSuppliersCard />
      </div>
    </div>
  );
}
