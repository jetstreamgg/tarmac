import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EarnTableFilters } from './EarnTableFilters';

// Pin the JS breakpoint per test (happy-dom's 1024 viewport = desktop).
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

const renderFilters = () => {
  render(
    <I18nProvider i18n={i18n}>
      <EarnTableFilters
        selectedRiskTiers={[]}
        onRiskTierToggle={vi.fn()}
        networks={[{ value: 'ethereum', label: 'Ethereum' }]}
        selectedNetwork="all"
        onNetworkChange={vi.fn()}
        stablecoins={[{ value: 'usds', label: 'USDS' }]}
        selectedStablecoin="all"
        onStablecoinChange={vi.fn()}
        products={[{ value: 'savings', label: 'Savings' }]}
        selectedProduct="all"
        onProductChange={vi.fn()}
      />
    </I18nProvider>
  );
};

describe('EarnTableFilters — mobile stacked selects (M6.2, comp 486:22051)', () => {
  beforeEach(() => {
    breakpoint.isMobile = true;
  });
  afterEach(() => {
    breakpoint.isMobile = false;
    cleanup();
  });

  it('renders the three selects full-width at 40px below md', () => {
    renderFilters();

    for (const id of ['earn-filter-network', 'earn-filter-stablecoin', 'earn-filter-product']) {
      const trigger = screen.getByTestId(id);
      expect(trigger.className).toContain('w-full');
      expect(trigger.className).toContain('h-10');
    }
  });

  it('keeps the risk chips row above the selects', () => {
    renderFilters();

    expect(screen.getByTestId('earn-filter-risk-low')).toBeTruthy();
    expect(screen.getByTestId('earn-filter-risk-moderate')).toBeTruthy();
    expect(screen.getByTestId('earn-filter-risk-advanced')).toBeTruthy();
  });
});

describe('EarnTableFilters — desktop toolbar unchanged', () => {
  afterEach(cleanup);

  it('keeps the compact triggers (no full-width override) at md and above', () => {
    renderFilters();

    const trigger = screen.getByTestId('earn-filter-network');
    expect(trigger.className).not.toContain('w-full');
    expect(trigger.className).not.toContain('h-10');
  });
});
