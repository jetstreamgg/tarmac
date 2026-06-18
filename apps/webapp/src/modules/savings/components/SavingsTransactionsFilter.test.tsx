import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(cleanup);

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
});
