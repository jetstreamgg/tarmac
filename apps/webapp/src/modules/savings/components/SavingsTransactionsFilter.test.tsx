import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// happy-dom's 1024px default always lands desktop; isMobile drives the M6.3
// mobile trigger variant.
const breakpoint = vi.hoisted(() => ({ isMobile: false }));

vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: breakpoint.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

import { SavingsTransactionsFilter, SavingsTxFilter } from './SavingsTransactionsFilter';

i18n.load('en', {});
i18n.activate('en');

const renderFilter = (value: SavingsTxFilter, onChange = vi.fn()) =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsTransactionsFilter value={value} onChange={onChange} />
    </I18nProvider>
  );

// Radix Select renders its options in a portal only once opened, and that
// interaction is unreliable under happy-dom (no pointer-capture/scrollIntoView
// polyfills — see slice 04 friction note). We assert the closed-state trigger
// here; the value -> visible-rows narrowing is covered in
// SavingsTransactionsTable.test.tsx.
describe('SavingsTransactionsFilter', () => {
  afterEach(() => {
    cleanup();
    breakpoint.isMobile = false;
  });

  it('renders the trigger labelled with the active filter', () => {
    renderFilter('all');

    const trigger = screen.getByTestId('savings-transactions-filter');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('All');
  });

  it('reflects a non-default selection in the trigger label', () => {
    renderFilter('withdraw');

    expect(screen.getByTestId('savings-transactions-filter').textContent).toContain('Withdraw');
  });

  it('exposes an accessible label for the control', () => {
    renderFilter('all');

    expect(screen.getByLabelText('Filter transactions')).toBeTruthy();
  });

  // M6.3 (Figma 486:20830): the mobile trigger is a full-width bordered pill
  // whose resting label reads "All transactions" instead of the desktop "All".
  it('labels the default filter "All transactions" on mobile', () => {
    breakpoint.isMobile = true;
    renderFilter('all');

    expect(screen.getByTestId('savings-transactions-filter').textContent).toContain('All transactions');
  });

  it('keeps the specific action labels on mobile', () => {
    breakpoint.isMobile = true;
    renderFilter('supply');

    expect(screen.getByTestId('savings-transactions-filter').textContent).toContain('Supply');
  });
});
