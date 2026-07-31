import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryTable } from './HistoryTable';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { HistoryRow } from './types';

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useConnection: () => ({ address: '0x1111111111111111111111111111111111111111' }),
    useChainId: () => 1
  };
});

i18n.load('en', {});
i18n.activate('en');

const makeRows = (n: number): HistoryRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i),
    textLeft: `row-${i}`,
    formattedDate: 'Jan 1, 2026',
    rawDate: new Date(1700000000000 - i * 1000),
    transactionHash: `0x${i}`
  }));

const renderTable = (history: HistoryRow[]) =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <HistoryTable history={history} isLoading={false} />
      </TooltipProvider>
    </I18nProvider>
  );

describe('HistoryTable — pagination', () => {
  afterEach(cleanup);

  it('keeps rendering rows when the row set shrinks under a stale page (APP-401)', () => {
    // 12 rows / 5 per page → 3 pages; walk to the last one.
    const { rerender } = renderTable(makeRows(12));
    fireEvent.click(screen.getByLabelText('Go to next page'));
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(screen.getByText('row-10')).toBeTruthy();

    // A smaller history arrives without a remount (e.g. wallet switch): the
    // stale offset must clamp to a real page, not the "no transactions" state.
    rerender(
      <I18nProvider i18n={i18n}>
        <TooltipProvider>
          <HistoryTable history={makeRows(4)} isLoading={false} />
        </TooltipProvider>
      </I18nProvider>
    );
    expect(screen.getByText('row-0')).toBeTruthy();
    expect(screen.queryByText('No transactions found')).toBeNull();
  });

  it('renders without pagination when rows fit one page', () => {
    renderTable(makeRows(3));

    expect(screen.queryByLabelText('Go to next page')).toBeNull();
  });
});
