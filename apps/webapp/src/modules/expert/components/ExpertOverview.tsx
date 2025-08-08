import { ExpertTvlCard } from './ExpertTvlCard';
import { ExpertSuppliersCard } from './ExpertSuppliersCard';

export function ExpertOverview() {
  return (
    <div className="flex w-full flex-wrap justify-between gap-3 xl:flex-nowrap">
      <ExpertTvlCard />
      <ExpertSuppliersCard />
    </div>
  );
}
