import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EarnTable, EarnTableRowItem } from './EarnTable';

// Pin the JS breakpoint per test (happy-dom's 1024 viewport = table mode).
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

const ROWS: EarnTableRowItem[] = [
  {
    id: 'savings',
    name: 'Sky Savings',
    isNew: true,
    risk: 'low',
    rate: '3.75%',
    rate30d: '3.70%',
    tvl: '$4.23b',
    position: '$0.00'
  },
  {
    id: 'spk',
    name: 'Earn SPK',
    risk: 'moderate',
    rate: '5.00%',
    rate30d: '4.90%',
    tvl: '$1.00b',
    position: '$10.00'
  }
];

const renderEarn = (onRowSelect = vi.fn()) => {
  render(
    <I18nProvider i18n={i18n}>
      <EarnTable
        rows={ROWS}
        sort={{ column: 'rate', direction: 'desc' }}
        onSortChange={vi.fn()}
        onRowSelect={onRowSelect}
      />
    </I18nProvider>
  );
  return onRowSelect;
};

describe('EarnTable — mobile accordion cards (M5)', () => {
  beforeEach(() => {
    breakpoint.isMobile = true;
  });
  afterEach(() => {
    breakpoint.isMobile = false;
    cleanup();
  });

  it('renders a card per row instead of the table, collapsed with name and rate', () => {
    renderEarn();

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Sky Savings')).toBeTruthy();
    expect(screen.getByText('Earn SPK')).toBeTruthy();
    // Collapsed: detail fields hidden.
    expect(screen.queryByText('TVL')).toBeNull();
  });

  it('expands a card to the detail grid and both action buttons', () => {
    renderEarn();

    fireEvent.click(screen.getByTestId('earn-card-toggle-savings'));

    expect(screen.getByText('TVL')).toBeTruthy();
    expect(screen.getByText('$4.23b')).toBeTruthy();
    expect(screen.getByText('My position')).toBeTruthy();
    expect(screen.getByText('30D Rate')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Supply' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View details' })).toBeTruthy();
  });

  it('collapses an expanded card on a second toggle', () => {
    renderEarn();

    fireEvent.click(screen.getByTestId('earn-card-toggle-savings'));
    fireEvent.click(screen.getByTestId('earn-card-toggle-savings'));
    expect(screen.queryByText('TVL')).toBeNull();
  });

  it('applies the M6.2 comp scale: 24px list corners, Label 5 title, Label 6 rate value', () => {
    renderEarn();

    expect(screen.getByTestId('earn-row-savings').className).toContain('rounded-t-3xl');
    expect(screen.getByTestId('earn-row-spk').className).toContain('rounded-b-3xl');

    const title = screen.getByText('Sky Savings');
    expect(title.className).toContain('text-sm');
    expect(title.className).toContain('md:text-base');

    expect(screen.getByTestId('earn-card-rate-savings').className).toContain('text-xs');
  });

  it('reports the row through onRowSelect from both expanded buttons', () => {
    const onRowSelect = renderEarn();

    fireEvent.click(screen.getByTestId('earn-card-toggle-savings'));
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(onRowSelect).toHaveBeenCalledWith('savings');

    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));
    expect(onRowSelect).toHaveBeenCalledWith('savings');
    expect(onRowSelect).toHaveBeenCalledTimes(2);
  });
});

describe('EarnTable — desktop table unchanged', () => {
  afterEach(cleanup);

  it('renders the sortable table at md and above', () => {
    renderEarn();

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByTestId('earn-sort-rate')).toBeTruthy();
  });
});

describe('EarnTable — NEW badge (APP-395, 1036:201322)', () => {
  afterEach(cleanup);

  it('marks only rows flagged isNew, on desktop and in the mobile cards', () => {
    renderEarn();
    expect(screen.getAllByText('NEW')).toHaveLength(1);
    expect(screen.getByTestId('earn-new-badge-savings')).toBeTruthy();
    cleanup();

    breakpoint.isMobile = true;
    renderEarn();
    expect(screen.getByTestId('earn-new-badge-savings')).toBeTruthy();
    breakpoint.isMobile = false;
  });
});
