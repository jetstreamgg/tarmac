import { MkrUpgradedToSky } from '@/modules/upgrade/components/MkrUpgradedToSky';
import { MkrUpgradedPercentage } from '@/modules/upgrade/components/MkrUpgradedPercentage';
import { RewardsSuppliersCard } from '@/modules/rewards/components/RewardsSuppliersCard';
import { SavingsRateCard } from '@/modules/savings/components/SavingsRateCard';
import { SkySavingsRatePoolCard } from '@/modules/savings/components/SkySavingsRatePoolCard';
import { UsdsTotalSupplyCard } from '@/modules/ui/components/UsdsTotalSupplyCard';
import { SavingsSuppliersCard } from '@/modules/savings/components/SavingsSuppliersCard';

export function BalancesSkyStatsOverview(): React.ReactElement {
  const isRestricted = import.meta.env.VITE_RESTRICTED_BUILD === 'true';

  return (
    <div className="flex w-full flex-wrap justify-between gap-3">
      <div className="min-w-[250px] flex-1">
        <UsdsTotalSupplyCard />
      </div>
      {!isRestricted && (
        <div className="min-w-[250px] flex-1">
          <SavingsRateCard />
        </div>
      )}
      {!isRestricted && (
        <div className="min-w-[250px] flex-1">
          <SkySavingsRatePoolCard />
        </div>
      )}
      <div className="min-w-[250px] flex-1">
        <MkrUpgradedToSky />
      </div>
      <div className="min-w-[250px] flex-1">
        <MkrUpgradedPercentage />
      </div>
      {!isRestricted && (
        <div className="min-w-[250px] flex-1">
          <RewardsSuppliersCard />
        </div>
      )}
      {!isRestricted && (
        <div className="min-w-[250px] flex-1">
          <SavingsSuppliersCard />
        </div>
      )}
    </div>
  );
}
