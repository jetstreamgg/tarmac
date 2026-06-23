import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Mutable history fed to the mocked useSavingsHistory — set per test before render.
const h = vi.hoisted(() => ({ history: [] as unknown[] }));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useSavingsHistory: () => ({ data: h.history, isLoading: false, error: null })
  };
});

vi.mock('@/modules/app/hooks/useSubgraphUrl', () => ({ useSubgraphUrl: () => 'http://test' }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { TransactionTypeEnum, TOKENS } from '@/hooks';
import { SavingsTransactionsTable } from './SavingsTransactionsTable';
import { SavingsTxFilter } from './SavingsTransactionsFilter';

const WAD = 10n ** 18n;

const supply = (hash: string) => ({
  assets: 100n * WAD,
  blockTimestamp: new Date('2024-01-01T00:00:00Z'),
  transactionHash: hash,
  type: TransactionTypeEnum.SUPPLY,
  token: TOKENS.usds
});

const withdraw = (hash: string) => ({
  ...supply(hash),
  assets: -50n * WAD,
  type: TransactionTypeEnum.WITHDRAW
});

const renderTable = (filter?: SavingsTxFilter) =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsTransactionsTable filter={filter} />
    </I18nProvider>
  );

// One "Completed" status badge renders per row, so its count == visible rows.
const rowCount = () => screen.queryAllByText('Completed').length;
const supplyRows = () => screen.queryAllByText('Supply').length;
const withdrawRows = () => screen.queryAllByText('Withdraw').length;

describe('SavingsTransactionsTable — action-type filter', () => {
  afterEach(cleanup);

  it('shows every transaction when filter is omitted (defaults to all)', () => {
    h.history = [supply('0xaaa1'), withdraw('0xbbb2'), supply('0xccc3')];
    renderTable();

    expect(rowCount()).toBe(3);
    expect(supplyRows()).toBe(2);
    expect(withdrawRows()).toBe(1);
  });

  it('shows every transaction when filter is "all"', () => {
    h.history = [supply('0xaaa1'), withdraw('0xbbb2'), supply('0xccc3')];
    renderTable('all');

    expect(rowCount()).toBe(3);
  });

  it('narrows to supplies only when filter is "supply"', () => {
    h.history = [supply('0xaaa1'), withdraw('0xbbb2'), supply('0xccc3')];
    renderTable('supply');

    expect(rowCount()).toBe(2);
    expect(supplyRows()).toBe(2);
    expect(withdrawRows()).toBe(0);
  });

  it('narrows to withdrawals only when filter is "withdraw"', () => {
    h.history = [supply('0xaaa1'), withdraw('0xbbb2'), supply('0xccc3')];
    renderTable('withdraw');

    expect(rowCount()).toBe(1);
    expect(withdrawRows()).toBe(1);
    expect(supplyRows()).toBe(0);
  });
});

describe('SavingsTransactionsTable — pagination resets on filter change', () => {
  afterEach(cleanup);

  it('returns to the first page when the filter changes', () => {
    // 9 supplies → two pages at the default page size of 7 (7 + 2).
    h.history = Array.from({ length: 9 }, (_, i) => supply(`0x${i}`));
    const { rerender } = renderTable('all');
    expect(rowCount()).toBe(7);

    // Advance to page 2 (the trailing 2 rows).
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(rowCount()).toBe(2);

    // Changing the filter must snap back to page 1, not strand the user on page 2.
    rerender(
      <I18nProvider i18n={i18n}>
        <SavingsTransactionsTable filter="supply" />
      </I18nProvider>
    );
    expect(rowCount()).toBe(7);
  });
});
