import { MkrUpgradedToSky } from './MkrUpgradedToSky';
import { MkrUpgradedPercentage } from './MkrUpgradedPercentage';

export function UpgradeStats() {
  return (
    <div
      data-testid="upgrade-stats-details"
      className="flex w-full flex-wrap justify-between gap-3 xl:flex-nowrap"
    >
      <MkrUpgradedToSky />
      <MkrUpgradedPercentage />
    </div>
  );
}
