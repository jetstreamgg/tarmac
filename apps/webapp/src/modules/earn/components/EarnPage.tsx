import { useEffect, useMemo } from 'react';
import { useChains } from 'wagmi';
import { useNavigate } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import { Morpho, Pendle } from '@/widgets';
import { useEarnMarketplace, EarnProductKind } from '@/hooks';
import { getChainIcon } from '@/utils';
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
import {
  isMorphoVault,
  isPendleFixed,
  productIconSymbol,
  productStatusType
} from '@/components/product/productVisuals';
import { filterEarnRows, sortEarnRows } from '../helpers/earnTableState';
import { formatMaturity } from '../helpers/formatMaturity';
import { formatUsdCompact } from '../helpers/formatUsdCompact';
import { useEarnTableState } from '../hooks/useEarnTableState';
import { EarnFeaturedCards } from './EarnFeaturedCards';

const NO_VALUE = '–';

const formatUsd = (totalUsd?: number) => (totalUsd !== undefined ? formatUsdCompact(totalUsd) : NO_VALUE);

/** Products carrying the editorial "NEW" marker in the list (1036:201322). */
const NEW_PRODUCT_IDS = ['savings'];

const PRODUCT_LABELS: Record<EarnProductKind, React.ReactNode> = {
  savings: <Trans>Savings</Trans>,
  rewards: <Trans>Rewards</Trans>,
  vault: <Trans>Vaults</Trans>,
  fixed: <Trans>Fixed yield</Trans>,
  stusds: <Trans>Expert</Trans>
};

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

  // Rows carry their chain icon (Figma 1036:201601, APP-432 item 7) at the
  // dropdown's 16px icon size — the same shape the portfolio filter uses.
  const networkOptions = useMemo<EarnFilterOption[]>(() => {
    const ids = [...new Set(rows.flatMap(row => row.networks))];
    return ids
      .map(id => ({ id, chain: chains.find(chain => chain.id === id) }))
      .filter(({ chain }) => chain !== undefined)
      .map(({ id, chain }) => ({
        value: chainSlugById[id],
        label: (
          <span className="flex items-center gap-2">
            {getChainIcon(id, 'h-4 w-4 shrink-0')}
            {chain!.name}
          </span>
        )
      }));
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
        riskProfile: row.riskProfile,
        isNew: NEW_PRODUCT_IDS.includes(row.id),
        // Bare logo — the comp's iconbox holds no chain chip (1036:201236);
        // networks live in their own column.
        icon: (
          <TokenIcon
            token={{ symbol: productIconSymbol(row) }}
            width={28}
            className="h-7 w-7"
            showChainIcon={false}
          />
        ),
        status: productStatusType(row),
        // Provider mark beside the name: Morpho for its vaults, Pendle for the
        // fixed-yield rows (1036:201260 — the Pendle mark was missing). The
        // bare marks here are the table's treatment; portfolio's `ProductGlyph`
        // is the smaller tiled variant, so only the predicates are shared.
        nameSuffix: isMorphoVault(row) ? (
          <Morpho className="h-4 w-4 rounded-sm" />
        ) : isPendleFixed(row) ? (
          <Pendle className="h-4 w-4" />
        ) : undefined,
        supply: <TokenIconStack symbols={row.supplyTokens} size={12} />,
        maturityLabel: row.maturity ? formatMaturity(row.maturity) : undefined,
        network: <CellNetworks>{row.networks.map(id => getChainIcon(id, 'h-full w-full'))}</CellNetworks>,
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
      // Mobile rhythm per 486:22051: 24px base stack gap (the heading and list
      // margins below stretch the seams the comp draws wider); C2's 20px gap
      // returns at md.
      className="desktop:px-[calc((100%+32px)/12)] flex w-full flex-col gap-6 py-4 md:gap-5 md:py-10"
      data-testid="earn-opportunities"
    >
      {/* Patterns/Headers, Earn hero type 5031:52345. The badge stats are
          static marketing copy, straight from the DS mock (same call as the
          Convert hero's "$0.00 Fees paid") — revisit if a live-stats source
          gets wired up. */}
      <PageHeaderHero
        className="py-8 md:py-10"
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
        title={<Trans>Only the best ways to put your stablecoins to work</Trans>}
        subtitleClassName="max-w-[271px] md:max-w-[513px]"
        subtitle={
          <Trans>
            Sky Protocol is where stablecoins go to work — and where they&apos;ve been going since 2017. $11B
            in circulation. Multiple strategies, one place.
          </Trans>
        }
      />
      <EarnFeaturedCards rows={rows} onSelect={handleRowSelect} />
      {/* Heading 6 on mobile (486:22121), Heading 5 on desktop (1036:201309, APP-395). */}
      <h2 className="text-fgPrimary font-circle mt-6 text-xl leading-[22px] font-medium tracking-[-0.4px] md:mt-14 md:text-2xl md:leading-[26px] md:tracking-[-0.48px]">
        <Trans>Earn Opportunities</Trans>
      </h2>
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
      {/* The mobile comp runs filters straight into the card list — divider is desktop-only. */}
      <div className="border-borderPrimary hidden border-b md:block" />
      {/* Comp runs 32px from the filters into the card list (24 gap + 8). */}
      <div className="mt-2 md:mt-0">
        <EarnTable rows={items} sort={sort} onSortChange={toggleSort} onRowSelect={handleRowSelect} />
      </div>
    </div>
  );
}
