import { StakeDetailsStrip } from './StakeDetailsStrip';
import { StakeEngineCard } from './StakeEngineCard';

/**
 * Statistics tab body: the details strip in the main column and the Sky Staking
 * Engine promo card in the right rail (hi-fi 486:31955). Read-only. The Rate/TVL
 * chart and borrow-utilization block land in the main column in a later slice.
 */
export function StakeStatisticsTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <StakeDetailsStrip />
      </div>
      <div className="lg:col-span-1">
        <StakeEngineCard />
      </div>
    </div>
  );
}
