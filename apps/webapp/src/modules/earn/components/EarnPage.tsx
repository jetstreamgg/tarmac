import { useEffect, useMemo } from 'react';
import { useChains } from 'wagmi';
import { useNavigate } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import { Morpho } from '@/widgets';
import { useEarnMarketplace, EarnProductKind } from '@/hooks';
import { formatNumber, getChainIcon } from '@/utils';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { QueryParams } from '@/lib/constants';
import { retainOnNavigate, useAppSearchParams } from '@/lib/navigation';
import { HeaderBadge, PageHeaderHero } from '@/components/ui/page-header';
import { IllustrationStaked } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { CellNetworks } from '@/components/ui/table-cells';
import { EarnTable, EarnTableRowItem } from '@/components/product/EarnTable';
import { EarnTableFilters, EarnFilterOption } from '@/components/product/EarnTableFilters';
import { productIconSymbol } from '@/components/product/productVisuals';
import { filterEarnRows, sortEarnRows } from '../helpers/earnTableState';
import { useEarnTableState } from '../hooks/useEarnTableState';

const NO_VALUE = '–';

const formatUsd = (totalUsd?: number) => (totalUsd !== undefined ? `$${formatNumber(totalUsd)}` : NO_VALUE);

const PRODUCT_LABELS: Record<EarnProductKind, React.ReactNode> = {
  savings: <Trans>Savings</Trans>,
  rewards: <Trans>Rewards</Trans>,
  vault: <Trans>Vaults</Trans>,
  fixed: <Trans>Fixed yield</Trans>,
  stusds: <Trans>Expert</Trans>
};

const maturityFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

/** The /earn destination: the Earn Opportunities marketplace section (C2). */
export function EarnPage() {
  const { rows } = useEarnMarketplace();
  const chains = useChains();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useAppSearchParams();
  const tokenParam = searchParams.get(QueryParams.Token);

  // Slug ↔ chain mapping for the network filter (same normalized names the
  // `network` query param uses).
  const chainSlugById = useMemo(
    () => Object.fromEntries(chains.map(chain => [chain.id, normalizeUrlParam(chain.name)])),
    [chains]
  );

  const networkOptions = useMemo<EarnFilterOption[]>(() => {
    const ids = [...new Set(rows.flatMap(row => row.networks))];
    return ids
      .map(id => ({ id, chain: chains.find(chain => chain.id === id) }))
      .filter(({ chain }) => chain !== undefined)
      .map(({ id, chain }) => ({ value: chainSlugById[id], label: chain!.name }));
  }, [rows, chains, chainSlugById]);

  const stablecoinOptions = useMemo<EarnFilterOption[]>(
    () =>
      [...new Set(rows.flatMap(row => row.supplyTokens))].map(symbol => ({
        value: symbol.toLowerCase(),
        label: (
          <span className="flex items-center gap-2">
            <TokenIcon token={{ symbol }} width={16} className="h-4 w-4" />
            {symbol}
          </span>
        )
      })),
    [rows]
  );

  const productOptions = useMemo<EarnFilterOption[]>(
    () =>
      [...new Set(rows.map(row => row.kind))].map(kind => ({
        value: kind,
        label: PRODUCT_LABELS[kind]
      })),
    [rows]
  );

  const { filters, updateFilters, toggleRiskTier, sort, toggleSort } = useEarnTableState({
    networks: networkOptions.map(option => option.value),
    stablecoins: stablecoinOptions.map(option => option.value),
    products: productOptions.map(option => option.value)
  });

  // Deep-link support: /earn?token=USDS preselects the supply-token filter, then
  // the param is consumed so subsequent manual filter changes aren't overridden.
  useEffect(() => {
    if (!tokenParam || stablecoinOptions.length === 0) return;
    const value = tokenParam.toLowerCase();
    if (stablecoinOptions.some(option => option.value === value)) {
      updateFilters({ stablecoin: value });
    }
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete(QueryParams.Token);
        return next;
      },
      { replace: true }
    );
  }, [tokenParam, stablecoinOptions, updateFilters, setSearchParams]);

  const visibleRows = useMemo(
    () => sortEarnRows(filterEarnRows(rows, filters, chainSlugById), sort),
    [rows, filters, chainSlugById, sort]
  );

  const items = useMemo<EarnTableRowItem[]>(
    () =>
      visibleRows.map(row => ({
        id: row.id,
        name: row.name,
        icon: <TokenIcon token={{ symbol: productIconSymbol(row) }} width={28} className="h-7 w-7" />,
        nameSuffix:
          row.kind === 'vault' && row.id.startsWith('vault-morpho') ? (
            <Morpho className="h-4 w-4 rounded-sm" />
          ) : undefined,
        supply: <TokenIconStack symbols={row.supplyTokens} size={12} />,
        maturityLabel: row.maturity ? maturityFormatter.format(new Date(row.maturity * 1000)) : undefined,
        network: <CellNetworks>{row.networks.map(id => getChainIcon(id, 'h-full w-full'))}</CellNetworks>,
        risk: row.risk,
        rate: row.rate.formatted,
        rate30d: row.rate30d?.formatted ?? NO_VALUE,
        tvl: formatUsd(row.tvl?.totalUsd),
        position: formatUsd(row.position?.totalUsd),
        isLoading: row.isLoading
      })),
    [visibleRows]
  );

  const handleRowSelect = (id: string) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    void navigate({ to: row.detailPath as '/', search: retainOnNavigate });
  };

  // The desktop px-calc insets the page to the middle 10 columns of the design
  // grid: (100% + gutter)/12 = one column + one gutter, exact at any width.
  return (
    <div
      className="desktop:px-[calc((100%+32px)/12)] flex w-full flex-col gap-5 py-4 md:py-10"
      data-testid="earn-opportunities"
    >
      {/* Patterns/Headers, Earn hero type 5031:52345. The badge stats are
          static marketing copy, straight from the DS mock (same call as the
          Convert hero's "$0.00 Fees paid") — revisit if a live-stats source
          gets wired up. */}
      <PageHeaderHero
        className="py-4 md:py-10"
        badges={
          <>
            <HeaderBadge icon={<IllustrationStaked boxSize={16} />}>
              <Trans>$11.02B in circulation</Trans>
            </HeaderBadge>
            <HeaderBadge icon={<IllustrationStaked boxSize={16} />}>
              <Trans>Operating for 7 years</Trans>
            </HeaderBadge>
          </>
        }
        title={<Trans>Your stablecoins, earning more</Trans>}
        subtitle={
          <Trans>
            Sky Protocol is where stablecoins go to work and where they&apos;ve been going since 2017. $11B in
            circulation. Multiple strategies, one place.
          </Trans>
        }
      />
      <EarnTableFilters
        selectedRiskTiers={filters.risk}
        onRiskTierToggle={toggleRiskTier}
        networks={networkOptions}
        selectedNetwork={filters.network}
        onNetworkChange={network => updateFilters({ network })}
        stablecoins={stablecoinOptions}
        selectedStablecoin={filters.stablecoin}
        onStablecoinChange={stablecoin => updateFilters({ stablecoin })}
        products={productOptions}
        selectedProduct={filters.product}
        onProductChange={product => updateFilters({ product })}
      />
      <div className="border-borderPrimary border-b" />
      <EarnTable rows={items} sort={sort} onSortChange={toggleSort} onRowSelect={handleRowSelect} />
    </div>
  );
}
