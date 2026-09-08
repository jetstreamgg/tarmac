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
  // Borrow Utilization (40px rhythm).
  //
  // Desktop: two columns — the left column stacks chart → Details →
  // Borrow Utilization 80px apart (B4/B6), the right rail holds the promo
  // card. `items-start` keeps the rail from stretching to the (much taller)
  // left column's height — the card sizes to its own content/min-height
  // instead (review item B7).
  return (
    <div className="grid items-start gap-5 lg:grid-cols-3 lg:gap-8">
      <div className="order-2 flex flex-col gap-10 lg:order-none lg:col-span-2 lg:gap-20">
        <StakeRateChart />
        <StakeDetailsStrip />
        <BorrowUtilizationBlock />
      </div>
      <div className="order-1 lg:sticky lg:top-32 lg:order-none lg:col-span-1">
        <StakeEngineCard />
      </div>
    </div>
  );
}
