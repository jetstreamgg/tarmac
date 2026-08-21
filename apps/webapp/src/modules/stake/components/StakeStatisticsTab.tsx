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
  // Desktop (review item B7): the chart and promo card are the grid's first
  // row — column 1-2 and column 3 — so the grid's own `align-items: stretch`
  // makes the promo card match the CHART's height, not the whole stack (the
  // comp's "391px = 391px" annotation is chart-to-card, not column-to-card).
  // Details + Borrow Utilization move to a second row, still confined to the
  // chart's 2-column width (lg:col-span-2, never full-bleed across column 3),
  // 80px below (B4/B6) via the grid's own row-gap.
  return (
    <div className="grid gap-5 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-20">
      <div className="order-2 lg:order-none lg:col-span-2">
        <StakeRateChart />
      </div>
      <div className="order-1 lg:order-none lg:col-span-1">
        <StakeEngineCard />
      </div>
      {/* The grid's own 20px gap already separates this from the chart above;
          `mt-5` brings mobile up to the documented 40px rhythm, reset at `lg`
          where the row-gap itself is the (now 80px) B4/B6 spacing. */}
      <div className="order-3 mt-5 flex flex-col gap-10 lg:order-none lg:col-span-2 lg:mt-0 lg:gap-20">
        <StakeDetailsStrip />
        <BorrowUtilizationBlock />
      </div>
    </div>
  );
}
