import { ReactNode, useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  BP,
  ModuleEnum,
  useAllNetworksCombinedHistory,
  useAvailableTokenRewardContractsForChains,
  useBreakpointIndex,
  useFilteredPortfolioHistory,
  useNetworkFilter
} from '@/hooks';
import { formatAddress, getChainIcon } from '@/utils';
import { cn } from '@/lib/cn';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { ConvertArrows } from '@/modules/icons';
import { ALL_PRODUCTS_LABEL, ALL_STABLECOINS_LABEL, FilterSelect } from '@/components/product/FilterSelect';
import { NetworkFilterSelect } from '@/components/product/NetworkFilterSelect';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard, TransactionCardSkeleton } from '@/components/product/TransactionCard';
import {
  CellAction,
  CellAmount,
  CellHash,
  CellNetworks,
  CellProduct,
  CellStatus
} from '@/components/ui/table-cells';
import { PortfolioTxRow, RewardTokenLookup, toPortfolioTxRow } from '../helpers/transactionRow';

const ALL = 'all';

/**
 * The products the history is grouped by, in dropdown order.
 *
 * A product is not always one module: Morpho and sUSDT are both "Vault", and
 * keying the filter by module put two identical "Vault" rows in the dropdown
 * (APP-443 item 21). One entry per product, each owning its module(s), is also
 * the single source of truth for the Product column's label.
 */
export const PRODUCT_GROUPS: { id: string; modules: ModuleEnum[]; label: () => string }[] = [
  { id: 'savings', modules: [ModuleEnum.SAVINGS], label: () => t`Savings` },
  { id: 'stusds', modules: [ModuleEnum.STUSDS], label: () => t`stUSDS` },
  { id: 'vault', modules: [ModuleEnum.MORPHO, ModuleEnum.SUSDT], label: () => t`Vault` },
  { id: 'fixed', modules: [ModuleEnum.PENDLE], label: () => t`Fixed Yield` },
  { id: 'rewards', modules: [ModuleEnum.REWARDS], label: () => t`Rewards` },
  { id: 'stake', modules: [ModuleEnum.STAKE], label: () => t`Staking` },
  { id: 'upgrade', modules: [ModuleEnum.UPGRADE], label: () => t`Upgrade` },
  { id: 'trade', modules: [ModuleEnum.TRADE], label: () => t`Trade` }
];

const groupForModule = (module: ModuleEnum) => PRODUCT_GROUPS.find(g => g.modules.includes(module));

// Human product name per module for the Product column.
function productName(module: ModuleEnum): string {
  return groupForModule(module)?.label() ?? '';
}

function actionIcon(row: PortfolioTxRow): ReactNode {
  if (row.module === ModuleEnum.TRADE) return <ConvertArrows width={16} height={16} />;
  return row.positive === false ? (
    <ArrowUpToLine className="size-4" />
  ) : (
    <ArrowDownToLine className="size-4" />
  );
}

const tokenIcon = (symbol: string, width = 12) => (
  <TokenIcon
    token={{ symbol }}
    width={width}
    showChainIcon={false}
    className={width >= 16 ? 'h-4 w-4' : 'h-3 w-3'}
  />
);

// Header action cell (icon + verb + relative time), shared by the desktop row
// and the mobile card header.
const actionCell = (row: PortfolioTxRow) => (
  <CellAction
    icon={actionIcon(row)}
    label={row.action}
    sublabel={formatDistanceToNowStrict(row.timestamp, { addSuffix: true })}
  />
);

const networkCell = (row: PortfolioTxRow) => (
  <CellNetworks>{getChainIcon(row.chainId, 'h-full w-full')}</CellNetworks>
);

const statusCell = (row: PortfolioTxRow) => <CellStatus status={row.status} />;

const productCell = (row: PortfolioTxRow) => (
  <CellProduct icon={tokenIcon(row.iconSymbol)} label={productName(row.module)} />
);

const suppliedCell = (row: PortfolioTxRow) => (
  <CellAmount icon={tokenIcon(row.iconSymbol)} amount={`${row.amount} ${row.symbol}`} usd={row.usd} />
);

const hashCell = (row: PortfolioTxRow) => (
  <CellHash label={formatAddress(row.txHash, 6, 4)} href={row.explorerHref} />
);

const COLUMNS: ProductTransactionColumn<PortfolioTxRow>[] = [
  { id: 'action', header: <Trans>Action</Trans>, width: '1.6fr', cell: actionCell },
  { id: 'network', header: <Trans>Network</Trans>, width: '0.8fr', skeleton: false, cell: networkCell },
  { id: 'status', header: <Trans>Status</Trans>, width: '1fr', cell: statusCell },
  { id: 'product', header: <Trans>Product</Trans>, width: '1fr', cell: productCell },
  { id: 'supplied', header: <Trans>Amounts</Trans>, width: '1.2fr', cell: suppliedCell },
  { id: 'hash', header: <Trans>Tx hash</Trans>, width: '1fr', cell: hashCell }
];

// Mobile card: Action is the header, Tx hash becomes the footer button, and the
// remaining Network / Status / Product / Amounts columns fold into the 2×2 grid.
// (The comp mislabels the top grid row "My position" / "APY" — placeholder text
// carried over from the PositionCard; the real fields are Network / Status.)
const renderCard = (row: PortfolioTxRow) => (
  <TransactionCard
    header={actionCell(row)}
    fields={[
      { label: <Trans>Network</Trans>, value: networkCell(row) },
      { label: <Trans>Status</Trans>, value: statusCell(row) },
      { label: <Trans>Product</Trans>, value: productCell(row) },
      { label: <Trans>Amounts</Trans>, value: suppliedCell(row) }
    ]}
    link={{ label: <Trans>View transaction</Trans>, href: row.explorerHref }}
  />
);

export interface PortfolioTransactionsViewProps {
  rows: PortfolioTxRow[];
  /**
   * Rows to derive the filter dropdown options from. Defaults to `rows`; the
   * section passes the unfiltered aggregate here so a server-scoped `rows` set
   * (e.g. only staking history) doesn't collapse the other filter choices.
   */
  optionRows?: PortfolioTxRow[];
  isLoading?: boolean;
  error?: Error | null;
  /** Notifies the data container so it can swap in a filter-scoped query. */
  onFiltersChange?: (filters: { stablecoin: string; product: string }) => void;
  /** Whether older history can be fetched from the server. */
  hasNextPage?: boolean;
  /** Fetches the next keyset page; called when the user lands on the last loaded page. */
  fetchNextPage?: () => void;
}

/**
 * Presentational transactions section — the title, three filters, and the
 * shared ProductTransactionsTable (card list below md) over already-normalized
 * rows. Split from the data container so it can be unit-tested and previewed
 * with fixture rows (the aggregate hook needs a funded wallet).
 */
export function PortfolioTransactionsView({
  rows,
  optionRows,
  isLoading,
  error,
  onFiltersChange,
  hasNextPage,
  fetchNextPage
}: PortfolioTransactionsViewProps) {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  // Network is the app-wide filter (lib/networkFilter); only stablecoin and
  // product are local to this toolbar.
  const { chainId: networkFilter } = useNetworkFilter();
  const [stablecoin, setStablecoin] = useState(ALL);
  const [product, setProduct] = useState(ALL);

  const changeFilters = (next: { stablecoin?: string; product?: string }) => {
    const merged = { stablecoin, product, ...next };
    setStablecoin(merged.stablecoin);
    setProduct(merged.product);
    onFiltersChange?.(merged);
  };

  // Filter options derived from what's actually present, so we never offer an
  // empty filter. Stablecoins are limited to rows that carry a USD value.
  // Products are grouped, so two modules that share a name (Morpho / sUSDT →
  // "Vault") offer one row that selects both.
  const { stablecoins, products } = useMemo(() => {
    const stable = new Map<string, ReactNode>();
    const groupIds = new Set<string>();
    for (const row of optionRows ?? rows) {
      if (row.usd) {
        stable.set(
          row.symbol,
          <span className="flex items-center gap-1.5">
            {tokenIcon(row.symbol, 16)}
            {row.symbol}
          </span>
        );
      }
      const group = groupForModule(row.module);
      if (group) groupIds.add(group.id);
    }
    return {
      stablecoins: [...stable].map(([value, label]) => ({ value, label })),
      products: PRODUCT_GROUPS.filter(group => groupIds.has(group.id)).map(group => ({
        value: group.id,
        label: group.label()
      }))
    };
  }, [optionRows, rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        row =>
          (networkFilter === null || row.chainId === networkFilter) &&
          (stablecoin === ALL || row.symbol === stablecoin) &&
          (product === ALL || groupForModule(row.module)?.id === product)
      ),
    [rows, networkFilter, stablecoin, product]
  );

  const filterKey = `${networkFilter ?? ALL}-${stablecoin}-${product}`;
  const triggerClassName = isMobile ? 'w-full' : undefined;

  return (
    <section className="flex flex-col gap-8" data-testid="portfolio-transactions">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Heading 5 from md (24/26/-0.48), Heading 6 below — the same section
            title scale as the reward sections directly above (comp 1036:190260). */}
        <h2 className="text-fgPrimary font-circle text-xl leading-[22px] font-medium tracking-[-0.4px] md:text-2xl md:leading-[26px] md:tracking-[-0.48px]">
          <Trans>Transactions</Trans>
        </h2>
        <div className={cn('flex gap-2 md:gap-3', isMobile ? 'flex-col' : 'flex-row')}>
          <NetworkFilterSelect testId="portfolio-tx-filter-network" triggerClassName={triggerClassName} />
          <FilterSelect
            testId="portfolio-tx-filter-stablecoin"
            options={stablecoins}
            selected={stablecoin}
            onChange={value => changeFilters({ stablecoin: value })}
            allLabel={ALL_STABLECOINS_LABEL}
            triggerClassName={triggerClassName}
          />
          <FilterSelect
            testId="portfolio-tx-filter-product"
            options={products}
            selected={product}
            onChange={value => changeFilters({ product: value })}
            allLabel={ALL_PRODUCTS_LABEL}
            triggerClassName={triggerClassName}
          />
        </div>
      </div>

      <ProductTransactionsTable
        key={filterKey}
        dataTestId="portfolio-transactions-table"
        columns={COLUMNS}
        rows={filtered}
        rowKey={row => row.id}
        isLoading={isLoading}
        error={error}
        renderCard={renderCard}
        cardSkeleton={<TransactionCardSkeleton fieldRows={2} />}
        onPageChange={(page, totalPages) => {
          // Last loaded page reached while older history exists server-side.
          if (hasNextPage && page >= totalPages) fetchNextPage?.();
        }}
      />
    </section>
  );
}

/**
 * Portfolio-wide Transactions section (D8/APP-391): the DS Table/Transactions
 * (486:20055 desktop / 486:20198 mobile) over `useFilteredPortfolioHistory` —
 * the 2-document all-networks aggregate by default, or a query scoped to the
 * active network/product filter so sparse categories paginate through their
 * own full history. Dropdown options always derive from the aggregate.
 */
export function PortfolioTransactionsSection() {
  const { chainId: networkFilter } = useNetworkFilter();
  const [product, setProduct] = useState(ALL);

  const aggregate = useAllNetworksCombinedHistory();
  const { data, isLoading, error, hasNextPage, fetchNextPage } = useFilteredPortfolioHistory({
    network: networkFilter ?? undefined,
    products: product === ALL ? undefined : PRODUCT_GROUPS.find(g => g.id === product)?.modules
  });

  // Reward claims only carry the reward contract address; resolve it to the
  // paid token (SPK / GROVE / …) per chain seen in the history (APP-426 item 7).
  const getRewardContracts = useAvailableTokenRewardContractsForChains();
  const rewardTokenByContract = useMemo(() => {
    const lookup: RewardTokenLookup = {};
    const chainIds = new Set<number>();
    for (const item of [...(aggregate.data ?? []), ...(data ?? [])]) {
      if ('chainId' in item) chainIds.add(item.chainId);
    }
    for (const id of chainIds) {
      for (const contract of getRewardContracts(id)) {
        lookup[`${id}-${contract.contractAddress.toLowerCase()}`] = contract.rewardToken.symbol;
      }
    }
    return lookup;
  }, [aggregate.data, data, getRewardContracts]);

  const optionRows = useMemo(
    () => (aggregate.data ?? []).map((item, i) => toPortfolioTxRow(item, i, rewardTokenByContract)),
    [aggregate.data, rewardTokenByContract]
  );
  const rows = useMemo(
    () => (data ?? []).map((item, i) => toPortfolioTxRow(item, i, rewardTokenByContract)),
    [data, rewardTokenByContract]
  );

  return (
    <PortfolioTransactionsView
      rows={rows}
      optionRows={optionRows}
      isLoading={isLoading}
      error={error}
      onFiltersChange={filters => setProduct(filters.product)}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
    />
  );
}
