import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductTransactionsTable, ProductTransactionColumn } from './ProductTransactionsTable';

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
