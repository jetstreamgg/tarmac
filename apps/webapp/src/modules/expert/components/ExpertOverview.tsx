import { ExpertTvlCard } from './ExpertTvlCard';
import { StUSDSSuppliersCard } from '@/modules/stusds/components/StUSDSSuppliersCard';
import { Trans } from '@lingui/react/macro';

export function ExpertOverview() {
  return (
    <div className="flex w-full flex-wrap justify-between gap-3">
      <div className="min-w-[250px] flex-1">
        <ExpertTvlCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <StUSDSSuppliersCard title={<Trans>stUSDS Suppliers</Trans>} />
      </div>
    </div>
  );
}
