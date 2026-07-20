import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, within, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleEnum, TransactionTypeEnum } from '@/hooks';
import type { PortfolioTxRow } from '../helpers/transactionRow';
import { PortfolioTransactionsView } from './PortfolioTransactionsSection';

i18n.load('en', {});
i18n.activate('en');

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChains: () => [
      { id: 1, name: 'Ethereum' },
      { id: 8453, name: 'Base' }
    ]
  };
});

// Render the desktop table (not the mobile card list) and skip token images.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return { ...actual, useBreakpointIndex: () => ({ bpi: 99 }) };
});
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

const row = (o: Partial<PortfolioTxRow>): PortfolioTxRow => ({
  id: 'r',
  txHash: '0x1234567890abcdef',
  timestamp: new Date('2026-07-20T00:00:00Z'),
  module: ModuleEnum.SAVINGS,
  type: TransactionTypeEnum.SUPPLY,
  chainId: 1,
  action: 'Savings Supply',
  symbol: 'USDS',
  amount: '1,000.00',
  usd: '$1,000.00',
  status: 'completed',
  positive: true,
  ...o
});

const renderView = (rows: PortfolioTxRow[], props = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <PortfolioTransactionsView rows={rows} {...props} />
    </I18nProvider>
  );

describe('PortfolioTransactionsView', () => {
  afterEach(() => cleanup());

  it('renders the title, three filters, and a row from the aggregated feed', () => {
    renderView([row({ id: 'a' })]);
    expect(screen.getByTestId('portfolio-transactions')).toBeDefined();
    expect(screen.queryByText('Transactions')).not.toBeNull();
    expect(screen.getByTestId('portfolio-tx-filter-network')).toBeDefined();
    expect(screen.getByTestId('portfolio-tx-filter-stablecoin')).toBeDefined();
    expect(screen.getByTestId('portfolio-tx-filter-product')).toBeDefined();

    const table = screen.getByTestId('portfolio-transactions-table');
    expect(within(table).queryByText('Savings Supply')).not.toBeNull();
    expect(within(table).queryByText('Savings')).not.toBeNull(); // product cell
    expect(within(table).queryByText('Completed')).not.toBeNull(); // status cell
  });

  it('maps a pending row to the Pending status pill', () => {
    renderView([row({ id: 'b', status: 'pending', module: ModuleEnum.TRADE, action: 'Trade' })]);
    const table = screen.getByTestId('portfolio-transactions-table');
    expect(within(table).queryByText('Pending')).not.toBeNull();
    // "Trade" is both the action label and the product name → two matches.
    expect(within(table).getAllByText('Trade').length).toBeGreaterThan(0);
  });

  it('shows the empty state when there are no transactions', () => {
    renderView([]);
    expect(screen.queryByText('No transactions yet')).not.toBeNull();
  });

  it('renders across products (distinct action labels + product names)', () => {
    renderView([
      row({ id: 'a', module: ModuleEnum.SAVINGS, action: 'Savings Supply' }),
      row({ id: 'b', module: ModuleEnum.MORPHO, action: 'Vault Withdraw', chainId: 8453, symbol: 'USDC' }),
      row({ id: 'c', module: ModuleEnum.STAKE, action: 'Stake', symbol: 'SKY', usd: undefined })
    ]);
    const table = screen.getByTestId('portfolio-transactions-table');
    expect(within(table).queryByText('Savings Supply')).not.toBeNull();
    expect(within(table).queryByText('Vault Withdraw')).not.toBeNull();
    expect(within(table).queryByText('Stake')).not.toBeNull();
    expect(within(table).queryByText('Staking')).not.toBeNull(); // stake product label
  });
});
