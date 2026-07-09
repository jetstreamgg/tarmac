import { StakeRateChart } from './StakeRateChart';
import { StakeDetailsStrip } from './StakeDetailsStrip';
import { BorrowUtilizationBlock } from './BorrowUtilizationBlock';
import { StakeEngineCard } from './StakeEngineCard';

/**
 * Statistics tab body (hi-fi 486:31955): the Rate/TVL chart card, the details
 * strip, and the borrow-utilization block in the main column, with the Sky
 * Staking Engine promo card in the right rail. Read-only.
 */
export function StakeStatisticsTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <StakeRateChart />
        <StakeDetailsStrip />
        <BorrowUtilizationBlock />
      </div>
      <div className="lg:col-span-1">
        <StakeEngineCard />
      </div>
    </div>
  );
}
