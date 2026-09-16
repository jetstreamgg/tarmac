import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { parseEther } from 'viem';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// 25% utilization: 250 USDS borrowed against 1,000 ceiling, 750 available.
const CAPACITY = {
  debtCeiling: parseEther('1000'),
  totalDebt: parseEther('250'),
  borrowCapacity: parseEther('750'),
  borrowUtilization: 25
};

// Inline USDS icon on the legend values pulls image/wagmi hooks we don't exercise
// here; stub to null so the numeric text stays assertable (same pattern the engine
// card test uses).
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useBorrowCapacityData: () => ({ data: CAPACITY, isLoading: false, error: null })
  };
});

import { BorrowUtilizationBlock } from './BorrowUtilizationBlock';

const renderBlock = () =>
  render(
    <I18nProvider i18n={i18n}>
      <BorrowUtilizationBlock />
    </I18nProvider>
  );

describe('BorrowUtilizationBlock', () => {
  afterEach(cleanup);

  it('renders the utilization hero percentage and the bar', () => {
    renderBlock();

    expect(screen.getByTestId('stake-borrow-utilization')).toBeTruthy();
    expect(screen.getByText('25.0%')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('renders both legend rows with formatted USDS values', () => {
    renderBlock();

    expect(screen.getByText('Borrowed (USDS)')).toBeTruthy();
    expect(screen.getByText('Available (USDS)')).toBeTruthy();
    expect(screen.getByText('250')).toBeTruthy();
    expect(screen.getByText('750')).toBeTruthy();
  });

  it('colors the Borrowed legend dot and bar fill brand purple, Available gray (hi-fi 486:31955)', () => {
    renderBlock();

    const dot = (label: string) => screen.getByText(label).parentElement!.querySelector('span[aria-hidden]')!;
    expect(dot('Borrowed (USDS)').className).toContain('bg-fgBrand');
    expect(dot('Available (USDS)').className).toContain('bg-fgSecondary/50');
    const bar = screen.getByRole('progressbar');
    expect(bar.querySelector('.bg-fgBrand')).toBeTruthy();
  });
});
