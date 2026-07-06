import { RewardsSuppliersCard } from './RewardsSuppliersCard';
import { TotalRewardsTvl } from './TotalRewardsTvl';

export function RewardsOverviewInfo() {
  return (
    <div className="flex w-full flex-wrap justify-between gap-3 overflow-auto xl:scrollbar-thin xl:flex-nowrap">
      <TotalRewardsTvl />
      <RewardsSuppliersCard />
    </div>
  );
}
