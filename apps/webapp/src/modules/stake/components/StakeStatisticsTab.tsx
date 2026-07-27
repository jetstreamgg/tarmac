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
  // Mobile comp 1222:17089 order: promo card → chart (20px below) → Details →
  // Borrow Utilization (40px rhythm); the lg grid keeps the rail on the right.
  return (
    <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
      <div className="order-2 flex flex-col gap-10 lg:order-none lg:col-span-2 lg:gap-6">
        <StakeRateChart />
        <StakeDetailsStrip />
        <BorrowUtilizationBlock />
      </div>
      <div className="order-1 lg:order-none lg:col-span-1">
        <StakeEngineCard />
      </div>
    </div>
  );
}
