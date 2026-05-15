import { SavingsRateCard } from '@/modules/savings/components/SavingsRateCard';
import { SkySavingsRatePoolCard } from '@/modules/savings/components/SkySavingsRatePoolCard';
import { UsdsTotalSupplyCard } from '@/modules/ui/components/UsdsTotalSupplyCard';
import { useGeoConfig } from '@/modules/geo-config';

export function BalancesSkyStatsOverview(): React.ReactElement {
  const { isRegionRestricted: isRestricted } = useGeoConfig();

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
    </div>
  );
}
