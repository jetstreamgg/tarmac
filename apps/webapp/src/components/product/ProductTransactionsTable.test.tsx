import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductTransactionsTable, ProductTransactionColumn } from './ProductTransactionsTable';

// Pin the JS breakpoint per test (happy-dom's viewport is 1024, i.e. table
// mode) — same pattern as responsive-modal.test.tsx.
const breakpoint = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: breakpoint.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

i18n.load('en', {});
i18n.activate('en');

type Row = { id: string };

const COLUMNS: ProductTransactionColumn<Row>[] = [
  { id: 'label', header: 'Label', width: '1fr', cell: row => <span>{`row-${row.id}`}</span> }
];

const makeRows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

const renderTable = (rows: Row[], pageSize?: number) =>
  render(
    <I18nProvider i18n={i18n}>
      <ProductTransactionsTable columns={COLUMNS} rows={rows} rowKey={row => row.id} pageSize={pageSize} />
    </I18nProvider>
  );

const visibleRows = () => screen.queryAllByText(/^row-/).map(el => el.textContent);

describe('ProductTransactionsTable — pagination', () => {
  afterEach(cleanup);

  it('renders at most one page of rows (default page size 7)', () => {
    renderTable(makeRows(15));
    expect(visibleRows()).toHaveLength(7);
    expect(visibleRows()).toContain('row-0');
    expect(visibleRows()).not.toContain('row-7');
  });

  it('reveals the next page of rows when the next control is clicked', () => {
    renderTable(makeRows(15));
    fireEvent.click(screen.getByLabelText('Go to next page'));

    expect(visibleRows()).toEqual(['row-7', 'row-8', 'row-9', 'row-10', 'row-11', 'row-12', 'row-13']);
    expect(visibleRows()).not.toContain('row-0');
  });

  it('shows no pagination control when the rows fit on one page', () => {
    renderTable(makeRows(7));
    expect(visibleRows()).toHaveLength(7);
    expect(screen.queryByRole('navigation', { name: 'pagination' })).toBeNull();
  });
});

describe('ProductTransactionsTable — renderBelowRow', () => {
  afterEach(cleanup);

  it('renders below-content only for rows the callback returns a node for', () => {
    render(
      <I18nProvider i18n={i18n}>
        <ProductTransactionsTable
          columns={COLUMNS}
          rows={makeRows(3)}
          rowKey={row => row.id}
          renderBelowRow={row => (row.id === '1' ? <div data-testid="below-1">below</div> : null)}
        />
      </I18nProvider>
    );

    expect(screen.getByTestId('below-1')).toBeTruthy();
    expect(screen.queryByTestId('below-0')).toBeNull();
    expect(screen.queryByTestId('below-2')).toBeNull();
  });

  it('does not fire onRowClick when the below-row content is clicked', () => {
    const onRowClick = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <ProductTransactionsTable
          columns={COLUMNS}
          rows={makeRows(2)}
          rowKey={row => row.id}
          onRowClick={onRowClick}
          renderBelowRow={row => (row.id === '0' ? <button data-testid="below-cta">CTA</button> : null)}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByTestId('below-cta'));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('leaves existing consumers byte-identical when renderBelowRow is omitted', () => {
    renderTable(makeRows(3));
    expect(visibleRows()).toHaveLength(3);
  });
});

describe('ProductTransactionsTable — mobile cards (M5)', () => {
  afterEach(cleanup);
  beforeEach(() => {
    breakpoint.isMobile = true;
  });

  const renderWithCards = (rows: Row[], pageSize?: number) =>
    render(
      <I18nProvider i18n={i18n}>
        <ProductTransactionsTable
          columns={COLUMNS}
          rows={rows}
          rowKey={row => row.id}
          pageSize={pageSize}
          renderCard={row => <div>{`card-${row.id}`}</div>}
        />
      </I18nProvider>
    );

  it('renders cards instead of the table below the md tier when renderCard is provided', () => {
    renderWithCards(makeRows(3));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getAllByText(/^card-/)).toHaveLength(3);
  });

  it('keeps the table at the md tier and above', () => {
    breakpoint.isMobile = false;
    renderWithCards(makeRows(3));
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.queryByText(/^card-/)).toBeNull();
  });

  it('keeps the (scrollable) table below md when no renderCard is provided', () => {
    renderTable(makeRows(3));
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('paginates cards exactly like table rows', () => {
    renderWithCards(makeRows(15));
    expect(screen.getAllByText(/^card-/)).toHaveLength(7);
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(screen.getAllByText(/^card-/).map(el => el.textContent)).toEqual([
      'card-7',
      'card-8',
      'card-9',
      'card-10',
      'card-11',
      'card-12',
      'card-13'
    ]);
  });

  it('renders below-row content after the matching card', () => {
    render(
      <I18nProvider i18n={i18n}>
        <ProductTransactionsTable
          columns={COLUMNS}
          rows={makeRows(3)}
          rowKey={row => row.id}
          renderCard={row => <div>{`card-${row.id}`}</div>}
          renderBelowRow={row => (row.id === '1' ? <div data-testid="below-1">below</div> : null)}
        />
      </I18nProvider>
    );
    expect(screen.getByTestId('below-1')).toBeTruthy();
  });

  it('shows the empty state on a card surface', () => {
    renderWithCards([]);
    expect(screen.getByText('No transactions yet.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
