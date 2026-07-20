import { ReactNode, useCallback, useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useChains } from 'wagmi';
import { BP, ModuleEnum, useAllNetworksCombinedHistory, useBreakpointIndex } from '@/hooks';
import { formatAddress, getChainIcon, getEtherscanLink } from '@/utils';
import { cn } from '@/lib/cn';
import { Heading } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ConvertArrows, ArrowDown, SavingsSupply } from '@/modules/icons';
import { FilterSelect } from '@/components/product/FilterSelect';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard } from '@/components/product/TransactionCard';
import {
  CellAction,
  CellAmount,
  CellHash,
  CellNetworks,
  CellProduct,
  CellStatus
} from '@/components/ui/table-cells';
import { PortfolioTxRow, toPortfolioTxRow } from '../helpers/transactionRow';

const ALL = 'all';

// Human product name per module for the Product column.
function productName(module: ModuleEnum): string {
  switch (module) {
    case ModuleEnum.SAVINGS:
      return t`Savings`;
    case ModuleEnum.STUSDS:
      return t`stUSDS`;
    case ModuleEnum.MORPHO:
    case ModuleEnum.SUSDT:
      return t`Vault`;
    case ModuleEnum.REWARDS:
      return t`Rewards`;
    case ModuleEnum.STAKE:
      return t`Staking`;
    case ModuleEnum.UPGRADE:
      return t`Upgrade`;
    case ModuleEnum.PENDLE:
      return t`Fixed Yield`;
    case ModuleEnum.TRADE:
      return t`Trade`;
    default:
      return '';
  }
}

function actionIcon(row: PortfolioTxRow): ReactNode {
  if (row.module === ModuleEnum.TRADE) return <ConvertArrows width={16} height={16} />;
  return row.positive === false ? (
    <ArrowDown width={12} height={16} className="light:fill-text fill-white" />
  ) : (
    <SavingsSupply width={16} height={15} />
  );
}

const tokenIcon = (symbol: string, width = 12) => (
  <TokenIcon token={{ symbol }} width={width} showChainIcon={false} className="h-3 w-3" />
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
  <CellProduct icon={tokenIcon(row.symbol)} label={productName(row.module)} />
);

const suppliedCell = (row: PortfolioTxRow) => (
  <CellAmount icon={tokenIcon(row.symbol)} amount={`${row.amount} ${row.symbol}`} usd={row.usd} />
);

const hashCell = (row: PortfolioTxRow) => (
  <CellHash label={formatAddress(row.txHash, 6, 4)} href={getEtherscanLink(row.chainId, row.txHash, 'tx')} />
);

const COLUMNS: ProductTransactionColumn<PortfolioTxRow>[] = [
  { id: 'action', header: <Trans>Action</Trans>, width: '1.6fr', cell: actionCell },
  { id: 'network', header: <Trans>Network</Trans>, width: '0.8fr', cell: networkCell },
  { id: 'status', header: <Trans>Status</Trans>, width: '1fr', cell: statusCell },
  { id: 'product', header: <Trans>Product</Trans>, width: '1fr', cell: productCell },
  { id: 'supplied', header: <Trans>Supplied</Trans>, width: '1.2fr', cell: suppliedCell },
  { id: 'hash', header: <Trans>Tx hash</Trans>, width: '1fr', cell: hashCell }
];

// Mobile card: Action is the header, Tx hash becomes the footer button, and the
// remaining Network / Status / Product / Supplied columns fold into the 2×2 grid.
// (The comp mislabels the top grid row "My position" / "APY" — placeholder text
// carried over from the PositionCard; the real fields are Network / Status.)
const renderCard = (row: PortfolioTxRow) => (
  <TransactionCard
    header={actionCell(row)}
    fields={[
      { label: <Trans>Network</Trans>, value: networkCell(row) },
      { label: <Trans>Status</Trans>, value: statusCell(row) },
      { label: <Trans>Product</Trans>, value: productCell(row) },
      { label: <Trans>Supplied</Trans>, value: suppliedCell(row) }
    ]}
    link={{ label: <Trans>View transaction</Trans>, href: getEtherscanLink(row.chainId, row.txHash, 'tx') }}
  />
);

export interface PortfolioTransactionsViewProps {
  rows: PortfolioTxRow[];
  isLoading?: boolean;
  error?: Error | null;
}

/**
 * Presentational transactions section — the title, three filters, and the
 * shared ProductTransactionsTable (card list below md) over already-normalized
 * rows. Split from the data container so it can be unit-tested and previewed
 * with fixture rows (the aggregate hook needs a funded wallet).
 */
export function PortfolioTransactionsView({ rows, isLoading, error }: PortfolioTransactionsViewProps) {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const chains = useChains();
  const chainName = useCallback((id: number) => chains.find(c => c.id === id)?.name ?? '', [chains]);

  const [network, setNetwork] = useState(ALL);
  const [stablecoin, setStablecoin] = useState(ALL);
  const [product, setProduct] = useState(ALL);

  // Filter options derived from what's actually present, so we never offer an
  // empty filter. Stablecoins are limited to rows that carry a USD value.
  const { networks, stablecoins, products } = useMemo(() => {
    const net = new Map<string, ReactNode>();
    const stable = new Map<string, ReactNode>();
    const prod = new Map<string, ReactNode>();
    for (const row of rows) {
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
      prod.set(row.module, productName(row.module));
    }
    return {
      networks: [...net].map(([value, label]) => ({ value, label })),
      stablecoins: [...stable].map(([value, label]) => ({ value, label })),
      products: [...prod].map(([value, label]) => ({ value, label }))
    };
  }, [rows, chainName]);

  const filtered = useMemo(
    () =>
      rows.filter(
        row =>
          (network === ALL || String(row.chainId) === network) &&
          (stablecoin === ALL || row.symbol === stablecoin) &&
          (product === ALL || row.module === product)
      ),
    [rows, network, stablecoin, product]
  );

  const filterKey = `${network}-${stablecoin}-${product}`;
  const triggerClassName = isMobile ? 'w-full' : undefined;

  return (
    <section className="flex flex-col gap-5" data-testid="portfolio-transactions">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Heading variant="small" tag="h2" className="text-fgPrimary">
          <Trans>Transactions</Trans>
        </Heading>
        <div className={cn('flex gap-2 md:gap-3', isMobile ? 'flex-col' : 'flex-row')}>
          <FilterSelect
            testId="portfolio-tx-filter-network"
            options={networks}
            selected={network}
            onChange={setNetwork}
            allLabel={<Trans>All networks</Trans>}
            triggerClassName={triggerClassName}
          />
          <FilterSelect
            testId="portfolio-tx-filter-stablecoin"
            options={stablecoins}
            selected={stablecoin}
            onChange={setStablecoin}
            allLabel={<Trans>All stablecoins</Trans>}
            triggerClassName={triggerClassName}
          />
          <FilterSelect
            testId="portfolio-tx-filter-product"
            options={products}
            selected={product}
            onChange={setProduct}
            allLabel={<Trans>All products</Trans>}
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
        emptyLabel={<Trans>No transactions yet</Trans>}
        renderCard={renderCard}
      />
    </section>
  );
}

/**
 * Portfolio-wide Transactions section (D8/APP-391): the aggregated
 * `useAllNetworksCombinedHistory` feed rendered as the DS Table/Transactions
 * (486:20055 desktop / 486:20198 mobile). Read-only over the existing
 * aggregate — no engine hooks touched.
 */
export function PortfolioTransactionsSection() {
  const { data, isLoading, error } = useAllNetworksCombinedHistory();
  const rows = useMemo(() => (data ?? []).map((item, i) => toPortfolioTxRow(item, i)), [data]);
  return <PortfolioTransactionsView rows={rows} isLoading={isLoading} error={error} />;
}
