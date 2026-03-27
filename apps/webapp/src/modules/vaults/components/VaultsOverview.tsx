import { VaultsTvlCard, VaultsRatesCard } from './VaultsTvlCard';

export function VaultsOverview() {
  return (
    <div className="flex w-full flex-wrap justify-between gap-3">
      <div className="min-w-[250px] flex-1">
        <VaultsTvlCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <VaultsRatesCard />
      </div>
    </div>
  );
}
