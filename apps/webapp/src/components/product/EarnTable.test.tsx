import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
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

// TokenIcon reaches for wagmi config (chain badges); the exposure stack only
// needs the wrapper spans, so stub the icon itself.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

i18n.load('en', {});
i18n.activate('en');

const ROWS: EarnTableRowItem[] = [
  {
    id: 'savings',
    name: 'Sky Savings',
    isNew: true,
    riskProfile: 'savings',
    rate: '3.75%',
    rate30d: '3.70%',
    tvl: '$4.23b',
    position: '$0.00'
  },
  {
    id: 'spk',
    name: 'Earn SPK',
    riskProfile: 'rewards-spk',
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

    // The row testid sits on the collapse wrapper; the radii live on the card
    // surface inside it.
    expect(screen.getByTestId('earn-row-savings').firstElementChild?.className).toContain('rounded-t-3xl');
    expect(screen.getByTestId('earn-row-spk').firstElementChild?.className).toContain('rounded-b-3xl');

    const title = screen.getByText('Sky Savings');
    expect(title.className).toContain('text-sm');
    expect(title.className).toContain('md:text-base');

    expect(screen.getByTestId('earn-card-rate-savings').className).toContain('text-xs');
  });

  it('drops the expanded state when the expanded card is filtered out', () => {
    const { rerender } = render(
      <I18nProvider i18n={i18n}>
        <EarnTable rows={ROWS} sort={{ column: 'rate', direction: 'desc' }} onSortChange={vi.fn()} />
      </I18nProvider>
    );

    fireEvent.click(screen.getByTestId('earn-card-toggle-savings'));
    expect(screen.getByText('TVL')).toBeTruthy();

    // Filter the expanded card out, then back in: it must return collapsed
    // (the buttons of a phantom expanded card were finding 5 on the review).
    rerender(
      <I18nProvider i18n={i18n}>
        <EarnTable rows={ROWS.slice(1)} sort={{ column: 'rate', direction: 'desc' }} onSortChange={vi.fn()} />
      </I18nProvider>
    );
    rerender(
      <I18nProvider i18n={i18n}>
        <EarnTable rows={ROWS} sort={{ column: 'rate', direction: 'desc' }} onSortChange={vi.fn()} />
      </I18nProvider>
    );

    // The exiting twin may still be mid-collapse in the DOM; the re-entered
    // card is the last toggle in document order and must be collapsed.
    const toggles = screen.getAllByTestId('earn-card-toggle-savings');
    expect(toggles[toggles.length - 1].getAttribute('aria-expanded')).toBe('false');
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

  it('declares the edge rows and keeps the collapsible cell markup TableRow styles against', () => {
    renderEarn();

    const first = screen.getByTestId('earn-row-savings');
    const last = screen.getByTestId('earn-row-spk');
    expect(first.getAttribute('data-first')).toBe('true');
    expect(first.getAttribute('data-last')).toBeNull();
    expect(last.getAttribute('data-last')).toBe('true');
    // TableRow's radius/hover selectors in ui/table.tsx target
    // td > wrapper > surface — if TableCell's internal markup changes, this
    // must fail with it.
    expect(first.querySelector('td > div > div')).not.toBeNull();
  });
});

describe('EarnTable — interactive risk profile (APP-396)', () => {
  afterEach(() => {
    breakpoint.isMobile = false;
    cleanup();
  });

  it('renders a risk details trigger per desktop row without hijacking row navigation', () => {
    const onRowSelect = renderEarn();

    // Scoped per row — the sortable column header answers to the same name.
    for (const row of ROWS) {
      const trigger = within(screen.getByTestId(`earn-row-${row.id}`)).getByRole('button', {
        name: 'Risk profile'
      });
      fireEvent.click(trigger);
    }
    expect(onRowSelect).not.toHaveBeenCalled();
  });

  it('opens the risk details sheet from the expanded mobile card grid', () => {
    breakpoint.isMobile = true;
    renderEarn();

    fireEvent.click(screen.getByTestId('earn-card-toggle-savings'));
    fireEvent.click(screen.getByRole('button', { name: 'Risk profile' }));

    expect(screen.getByText('Core')).toBeTruthy();
    expect(screen.getByText('Withdrawals')).toBeTruthy();
  });
});

describe('EarnTable — dimmed "unavailable" variant (APP-432 item 8, 1036:201476)', () => {
  afterEach(() => {
    breakpoint.isMobile = false;
    cleanup();
  });

  const renderDimmed = (onRowSelect = vi.fn()) => {
    render(
      <I18nProvider i18n={i18n}>
        <EarnTable
          rows={ROWS}
          sort={{ column: 'rate', direction: 'desc' }}
          onSortChange={vi.fn()}
          onRowSelect={onRowSelect}
          dimmed
          testIdPrefix="earn-unavailable"
        />
      </I18nProvider>
    );
    return onRowSelect;
  };

  it('namespaces its test ids so it can sit beside the marketplace table', () => {
    renderDimmed();

    expect(screen.getByTestId('earn-unavailable-opportunities-table')).toBeTruthy();
    expect(screen.getByTestId('earn-unavailable-row-savings')).toBeTruthy();
    expect(screen.queryByTestId('earn-row-savings')).toBeNull();
    expect(screen.queryByTestId('earn-sort-rate')).toBeNull();
  });

  it('never selects a row, by click or keyboard', () => {
    const onRowSelect = renderDimmed();
    const row = screen.getByTestId('earn-unavailable-row-savings');

    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });

    expect(onRowSelect).not.toHaveBeenCalled();
    expect(row.getAttribute('tabindex')).toBeNull();
  });

  it('drops the values to fg-tertiary and dims the icon slots', () => {
    renderDimmed();
    const row = screen.getByTestId('earn-unavailable-row-savings');

    expect(row.className).toContain('text-fgTertiary');
    expect(row.querySelectorAll('.opacity-50').length).toBeGreaterThan(0);
  });

  it('keeps the mobile accordion but drops both actions', () => {
    breakpoint.isMobile = true;
    renderDimmed();

    fireEvent.click(screen.getByTestId('earn-unavailable-card-toggle-savings'));

    expect(screen.getByText('TVL')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Supply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
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
