import { useState } from 'react';
import { useChains, useConnection, useEnsName } from 'wagmi';
import { mainnet } from 'viem/chains';
import { Trans } from '@lingui/react/macro';
import { useEarnMarketplace } from '@/hooks';
import { formatAddress, getChainIcon } from '@/utils';
import { FilterSelect, type FilterOption } from '@/components/product/FilterSelect';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { buildSuppliedView } from '../helpers/suppliedView';
import { StablecoinEarningsCard } from './StablecoinEarningsCard';
import { SuppliedPositionsCarousel } from './SuppliedPositionsCarousel';
import { type PortfolioTab } from './PortfolioTabs';

export function PortfolioPage() {
  const { rows, isLoading } = useEarnMarketplace();
  const { address } = useConnection();
  const chains = useChains();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });

  // 'all' or a chain id (as string, the FilterSelect value type).
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  // Supplied/Idle is shared across sections (earnings card + positions carousel).
  const [tab, setTab] = useState<PortfolioTab>('supplied');

  const view = buildSuppliedView(rows, selectedNetwork === 'all' ? 'all' : Number(selectedNetwork));

  const chainName = (id: number) => chains.find(chain => chain.id === id)?.name ?? `Chain ${id}`;

  const networkOptions: FilterOption[] = view.networksWithPositions.map(id => ({
    value: String(id),
    label: (
      <span className="flex items-center gap-2">
        {getChainIcon(id, 'h-4 w-4')}
        {chainName(id)}
      </span>
    )
  }));

  const allNetworksLabel = (
    <span className="flex items-center gap-2">
      <span className="flex -space-x-1">
        {view.networksWithPositions.map(id => (
          <span key={id} className="inline-flex">
            {getChainIcon(id, 'h-4 w-4')}
          </span>
        ))}
      </span>
      <Trans>All networks</Trans>
    </span>
  );

  const displayName = ensName ?? (address ? formatAddress(address) : undefined);

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:px-8 md:py-10" data-testid="portfolio-page">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {displayName && (
            <Text variant="medium" className="text-textSecondary">
              <Trans>Welcome back, {displayName}</Trans>
            </Text>
          )}
          <Heading tag="h1" variant="large" className="text-4xl leading-tight">
            <Trans>Your Stablecoin Earnings</Trans>
          </Heading>
        </div>
        <FilterSelect
          options={networkOptions}
          selected={selectedNetwork}
          onChange={setSelectedNetwork}
          allLabel={allNetworksLabel}
          testId="portfolio-network-filter"
        />
      </div>

      <StablecoinEarningsCard view={view} isLoading={isLoading} tab={tab} onTabChange={setTab} />
      <SuppliedPositionsCarousel view={view} isLoading={isLoading} tab={tab} onTabChange={setTab} />
    </div>
  );
}
