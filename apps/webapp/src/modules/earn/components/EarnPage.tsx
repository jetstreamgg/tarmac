import { useMemo } from 'react';
import { useChains } from 'wagmi';
import { useNavigate } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import { Morpho, Pendle } from '@/widgets';
import { useEarnMarketplace, EarnProductKind, useUsdsDaiData, type EarnProductRow } from '@/hooks';
import { getChainIcon } from '@/utils';
import { useGeoConfig } from '@/modules/geo-config';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { retainOnNavigate } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { HeaderBadge, PageHeaderHero } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterX, IllustrationStaked } from '@/modules/icons';
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
import { partitionByGeoAvailability } from '../helpers/geoAvailability';
import { formatMaturity } from '../helpers/formatMaturity';
import { formatUsdCompact } from '../helpers/formatUsdCompact';
import { formatCirculation, formatCirculationCoarse, protocolStartYear } from '../helpers/protocolStats';
import { useEarnTableState } from '../hooks/useEarnTableState';
import { EarnFeaturedCards } from './EarnFeaturedCards';
import { ProtocolLineageBadge } from './ProtocolLineageBadge';
import { setPendingNavIntent } from '@/modules/analytics/lib/navigationIntent';

const NO_VALUE = '–';

/** Stable identity so the geo split doesn't rebuild the tables every render. */
const EMPTY_ROWS: EarnProductRow[] = [];

const formatUsd = (totalUsd?: number) => (totalUsd !== undefined ? formatUsdCompact(totalUsd) : NO_VALUE);

/**
 * Products carrying the editorial "NEW" marker in the list (1036:201322).
 * Intentionally empty: nothing has launched recently enough to earn it
 * (APP-457). The badge itself stays wired up for the next product — add its
 * registry id here.
 */
const NEW_PRODUCT_IDS: string[] = [];

/** Heading 6 on mobile (486:22121), Heading 5 on desktop (1036:201309, APP-395). */
const SECTION_HEADING =
  'text-fgPrimary font-circle mt-6 text-xl leading-[22px] font-medium tracking-[-0.4px] md:mt-14 md:text-2xl md:leading-[26px] md:tracking-[-0.48px]';

const PRODUCT_LABELS: Record<EarnProductKind, React.ReactNode> = {
  savings: <Trans>Savings</Trans>,
  rewards: <Trans>Rewards</Trans>,
  vault: <Trans>Vaults</Trans>,
  fixed: <Trans>Fixed yield</Trans>,
  stusds: <Trans>Expert</Trans>
};

/**
 * Marketplace row → table row. `unavailable` rows land in the geo-restricted
 * section: the editorial NEW marker is an invitation to act, so it is dropped
 * there; everything else renders identically and EarnTable's `dimmed` prop
 * carries the visual treatment.
 */
function toTableRow(row: EarnProductRow, unavailable = false): EarnTableRowItem {
  return {
    id: row.id,
    name: row.name,
    riskProfile: row.riskProfile,
    isNew: !unavailable && NEW_PRODUCT_IDS.includes(row.id),
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
  };
}

/** The /earn destination: the Earn Opportunities marketplace section (C2). */
export function EarnPage() {
  const { rows } = useEarnMarketplace();
  const { isModuleEnabled, isLoading: isGeoLoading, isRegionVerified } = useGeoConfig();
  const chains = useChains();
  const navigate = useNavigate();

  // Geo split (1036:201400, APP-432 item 8): products whose owning module is
  // restricted in this region drop out of Earn Opportunities and reappear,
  // dimmed, in the "Products unavailable in the US" section — per the comp's
  // annotation, we still show them rather than hiding them outright. The
  // provider reports every module disabled while the lookup is in flight, so
  // until it settles everything counts as available and the list doesn't
  // flash through the restricted layout.
  const { availableRows, unavailableRows } = useMemo(
    () =>
      isGeoLoading
        ? { availableRows: rows, unavailableRows: EMPTY_ROWS }
        : partitionByGeoAvailability(rows, isModuleEnabled),
    [rows, isGeoLoading, isModuleEnabled]
  );

  // Hero stat: total USDS + DAI outstanding, the same BA Labs series the
  // portfolio totals chart and UsdsTotalSupplyCard read (APP-432 item 3). One
  // row is all the hero needs — the endpoint returns newest-first.
  const { data: usdsDaiData, isLoading: circulationIsLoading } = useUsdsDaiData({ limit: 1 });
  // The fetch helper swallows failures into an empty array, so "loaded but
  // absent" is the error state too: drop the stat rather than show a zero.
  const parsedTotal = parseFloat(usdsDaiData?.[0]?.total ?? '');
  const circulation = Number.isFinite(parsedTotal) ? parsedTotal : undefined;

  // Named so the extracted message ids read "{amount} in circulation" rather
  // than a positional "{0}".
  const amount = circulation !== undefined ? formatCirculation(circulation) : undefined;
  const coarseAmount = circulation !== undefined ? formatCirculationCoarse(circulation) : undefined;

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
            {/* Dropdown rows carry the bare token logo — no chain badge
                (APP-443 item 11): the network is its own filter. */}
            <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="h-4 w-4" />
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

  // Stable identity so the filter state (and everything derived from it) isn't
  // rebuilt on every render.
  const filterOptionValues = useMemo(
    () => ({
      networks: networkOptions.map(option => option.value),
      stablecoins: stablecoinOptions.map(option => option.value),
      products: productOptions.map(option => option.value)
    }),
    [networkOptions, stablecoinOptions, productOptions]
  );

  const { filters, updateFilters, toggleRiskTier, clearFilters, hasActiveFilters, sort, toggleSort } =
    useEarnTableState(filterOptionValues);

  // Both tables run through the same filters and share one sort, so the two
  // sections always read as one list split in two.
  const visibleRows = useMemo(
    () => sortEarnRows(filterEarnRows(availableRows, filters, chainSlugById), sort),
    [availableRows, filters, chainSlugById, sort]
  );

  const visibleUnavailableRows = useMemo(
    () => sortEarnRows(filterEarnRows(unavailableRows, filters, chainSlugById), sort),
    [unavailableRows, filters, chainSlugById, sort]
  );

  // What the filters are holding back from the main table — the figure the
  // "Clear filters" control carries.
  const hiddenRowCount = availableRows.length - visibleRows.length;

  const items = useMemo<EarnTableRowItem[]>(() => visibleRows.map(row => toTableRow(row)), [visibleRows]);

  const unavailableItems = useMemo<EarnTableRowItem[]>(
    () => visibleUnavailableRows.map(row => toTableRow(row, true)),
    [visibleUnavailableRows]
  );

  const handleRowSelect = (id: string) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    setPendingNavIntent('card', row.detailPath);
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
      {/* Patterns/Headers, Earn hero type 5031:52345. */}
      <PageHeaderHero
        className="py-8 md:py-10"
        badges={
          <>
            {/* Pill-shaped placeholder at the badge's own height (28px, 32px
                from md) so the hero doesn't reflow when the stat lands. Width
                is the settled badge's (~160px; it drifts a few px with the
                figure's digit count) rounded to its sibling's, so the pair
                reads as balanced while loading. */}
            {circulationIsLoading ? (
              <Skeleton className="h-7 w-[164px] rounded-full md:h-8" />
            ) : amount !== undefined ? (
              <HeaderBadge icon={<IllustrationStaked boxSize={16} />}>
                <Trans>{amount} in circulation</Trans>
              </HeaderBadge>
            ) : null}
            {/* Owns its own year count — the badge and the lineage tooltip it
                carries read the same PROTOCOL_START the subtitle does. */}
            <ProtocolLineageBadge />
          </>
        }
        title={<Trans>Only the best ways to put your stablecoins to work</Trans>}
        subtitleClassName="max-w-[271px] md:max-w-[513px]"
        // Three standalone sentences, so each is its own translation unit — the
        // middle one carries the live figure and can drop out entirely.
        subtitle={
          <>
            <Trans>
              Sky Protocol is where stablecoins go to work — and where they&apos;ve been going since{' '}
              {protocolStartYear}.
            </Trans>{' '}
            {circulationIsLoading ? (
              <Skeleton className="inline-block h-3 w-16 rounded-full align-[-1px]" />
            ) : coarseAmount !== undefined ? (
              <Trans>{coarseAmount} in circulation.</Trans>
            ) : null}{' '}
            <Trans>Multiple strategies, one place.</Trans>
          </>
        }
      />
      {/* Restricted products are never featured: their Earn CTA would land on a
          route that redirects straight back to /portfolio. */}
      <EarnFeaturedCards rows={availableRows} onSelect={handleRowSelect} />
      <h2 className={SECTION_HEADING}>
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
      {/* No rule between the filter bar and the table — the comp (1030:61244)
          draws none at either tier (APP-443 item 10); it just runs 32px of
          clear space from the filters into the table, which is the stack gap
          plus this margin (24+8 mobile, 20+12 from md). */}
      <div className="mt-2 md:mt-3">
        <EarnTable rows={items} sort={sort} onSortChange={toggleSort} onRowSelect={handleRowSelect} />
      </div>
      {/* Escape hatch under the table (Figma 1980:45477): there once the filters
          are actually holding rows back, and the count is how many — from the
          table right above it, the geo-restricted section below keeps its own
          tally out of it. A filter that hides nothing needs no escape hatch, so
          the control never reads "(0)". */}
      {hasActiveFilters && hiddenRowCount > 0 && (
        <Button
          variant="secondary"
          size="m"
          onClick={clearFilters}
          data-testid="earn-clear-filters"
          // The size recipe tucks a leading glyph in by 8px (the DS pads icons
          // tighter than text); this comp insets it the full 16, so put the
          // padding back.
          className="mx-auto pr-6 [&>svg:first-child]:ml-0"
        >
          <FilterX className="size-4" />
          <span>
            <Trans>Clear filters</Trans> <span className="text-fgSecondary">({hiddenRowCount})</span>
          </span>
        </Button>
      )}
      {/* "Products unavailable in the US" (1036:201473) — same table, dimmed and
          inert, always last on the page. Hidden entirely when the region (or
          the active filters) leaves nothing to list. When the geo lookup never
          resolved a country we fall back to the restrictive config, so the
          section names no region and says why instead (PR #1776 review). */}
      {unavailableItems.length > 0 && (
        <section className="flex flex-col gap-6 md:gap-8" data-testid="earn-unavailable">
          <div className="flex flex-col gap-2">
            <h2 className={SECTION_HEADING}>
              {isRegionVerified ? (
                <Trans>Products unavailable in the US</Trans>
              ) : (
                <Trans>Products unavailable in your region</Trans>
              )}
            </h2>
            {!isRegionVerified && (
              <p
                className="text-fgSecondary max-w-[513px] text-xs leading-[18px]"
                data-testid="earn-unavailable-reason"
              >
                <Trans>We couldn&apos;t verify your region, so these products are unavailable.</Trans>
              </p>
            )}
          </div>
          <EarnTable
            rows={unavailableItems}
            sort={sort}
            onSortChange={toggleSort}
            dimmed
            testIdPrefix="earn-unavailable"
          />
        </section>
      )}
    </div>
  );
}
