import { ReactNode, useCallback, useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useChains } from 'wagmi';
import {
  BP,
  ModuleEnum,
  useAllNetworksCombinedHistory,
  useAvailableTokenRewardContractsForChains,
  useBreakpointIndex,
  useFilteredPortfolioHistory
} from '@/hooks';
import { formatAddress, getChainIcon } from '@/utils';
import { cn } from '@/lib/cn';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TransactionActionIcon } from '@/components/product/TransactionActionIcon';
import {
  ALL_NETWORKS_LABEL,
  ALL_PRODUCTS_LABEL,
  ALL_STABLECOINS_LABEL,
  FilterSelect
} from '@/components/product/FilterSelect';
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
    icon={<TransactionActionIcon module={row.module} positive={row.positive} />}
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
  onFiltersChange?: (filters: { network: string; stablecoin: string; product: string }) => void;
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
  const chains = useChains();
  const chainName = useCallback((id: number) => chains.find(c => c.id === id)?.name ?? '', [chains]);

  const [network, setNetwork] = useState(ALL);
  const [stablecoin, setStablecoin] = useState(ALL);
  const [product, setProduct] = useState(ALL);

  const changeFilters = (next: { network?: string; stablecoin?: string; product?: string }) => {
    const merged = { network, stablecoin, product, ...next };
    setNetwork(merged.network);
    setStablecoin(merged.stablecoin);
    setProduct(merged.product);
    onFiltersChange?.(merged);
  };

  // Filter options derived from what's actually present, so we never offer an
  // empty filter. Stablecoins are limited to rows that carry a USD value.
  // Products are grouped, so two modules that share a name (Morpho / sUSDT →
  // "Vault") offer one row that selects both.
  const { networks, stablecoins, products } = useMemo(() => {
    const net = new Map<string, ReactNode>();
    const stable = new Map<string, ReactNode>();
    const groupIds = new Set<string>();
    for (const row of optionRows ?? rows) {
      net.set(
        String(row.chainId),
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 shrink-0">{getChainIcon(row.chainId, 'h-full w-full')}</span>
          {chainName(row.chainId)}
        </span>
      );
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
      networks: [...net].map(([value, label]) => ({ value, label })),
      stablecoins: [...stable].map(([value, label]) => ({ value, label })),
      products: PRODUCT_GROUPS.filter(group => groupIds.has(group.id)).map(group => ({
        value: group.id,
        label: group.label()
      }))
    };
  }, [optionRows, rows, chainName]);

  const filtered = useMemo(
    () =>
      rows.filter(
        row =>
          (network === ALL || String(row.chainId) === network) &&
          (stablecoin === ALL || row.symbol === stablecoin) &&
          (product === ALL || groupForModule(row.module)?.id === product)
      ),
    [rows, network, stablecoin, product]
  );

  const filterKey = `${network}-${stablecoin}-${product}`;
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
          <FilterSelect
            testId="portfolio-tx-filter-network"
            options={networks}
            selected={network}
            onChange={value => changeFilters({ network: value })}
            allLabel={ALL_NETWORKS_LABEL}
            triggerClassName={triggerClassName}
          />
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
  const [network, setNetwork] = useState(ALL);
  const [product, setProduct] = useState(ALL);

  const aggregate = useAllNetworksCombinedHistory();
  const { data, isLoading, error, hasNextPage, fetchNextPage } = useFilteredPortfolioHistory({
    network: network === ALL ? undefined : Number(network),
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
      onFiltersChange={filters => {
        setNetwork(filters.network);
        setProduct(filters.product);
      }}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
    />
  );
}
