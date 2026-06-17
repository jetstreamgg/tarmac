import { useState } from 'react';
import { useChainId, useChains, useConnection, useEnsName } from 'wagmi';
import { mainnet } from 'viem/chains';
import { Trans } from '@lingui/react/macro';
import { useEarnMarketplace, useOverallSkyData } from '@/hooks';
import { formatAddress, getChainIcon } from '@/utils';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { FilterSelect, type FilterOption } from '@/components/product/FilterSelect';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { buildSuppliedView } from '../helpers/suppliedView';
import { buildIdleSupplyInfo, buildIdleView } from '../helpers/idleView';
import { useStablecoinBalances } from '../hooks/useStablecoinBalances';
import { StablecoinEarningsCard } from './StablecoinEarningsCard';
import { PortfolioPositionsSection } from './PortfolioPositionsSection';
import { type PortfolioTab } from './PortfolioTabs';

export function PortfolioPage() {
  const connectedChainId = useChainId();
  const { rows, isLoading } = useEarnMarketplace();
  const { balances, isLoading: balancesLoading } = useStablecoinBalances();
  const { data: overallSkyData } = useOverallSkyData();
  const { address } = useConnection();
  const chains = useChains();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });

  // 'all' or a chain id (as string, the FilterSelect value type).
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  // Supplied/Idle is shared across sections (earnings card + positions carousel).
  const [tab, setTab] = useState<PortfolioTab>('supplied');

  const network = selectedNetwork === 'all' ? 'all' : Number(selectedNetwork);
  const suppliedView = buildSuppliedView(rows, network);
  const idleView = buildIdleView(balances, network);
  // Best supply rate + venue count per token, for the idle table's rate badge.
  const idleSupplyInfo = buildIdleSupplyInfo(rows);

  // Sky Savings Rate as a decimal fraction (drives the Idle footer + projection).
  const savingsRate = overallSkyData?.skySavingsRatecRate
    ? parseFloat(overallSkyData.skySavingsRatecRate)
    : 0;

  // The filter lists every supported chain — idle balances may sit on a chain
  // where the user has no supplied position.
  const supportedChainIds = getSupportedChainIds(connectedChainId);
  const chainName = (id: number) => chains.find(chain => chain.id === id)?.name ?? `Chain ${id}`;

  const networkOptions: FilterOption[] = supportedChainIds.map(id => ({
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
        {supportedChainIds.map(id => (
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

      <StablecoinEarningsCard
        suppliedView={suppliedView}
        suppliedLoading={isLoading}
        idleView={idleView}
        idleLoading={balancesLoading}
        savingsRate={savingsRate}
        tab={tab}
        onTabChange={setTab}
      />
      <PortfolioPositionsSection
        suppliedView={suppliedView}
        suppliedLoading={isLoading}
        idleView={idleView}
        idleSupplyInfo={idleSupplyInfo}
        idleLoading={balancesLoading}
        tab={tab}
        onTabChange={setTab}
      />
    </div>
  );
}
