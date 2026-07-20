import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';
import type { EarnProductRow } from '@/hooks';
import { EarnFeaturedCards, HIGHLIGHTED_PRODUCTS } from './EarnFeaturedCards';

// Pin the JS breakpoint per test (happy-dom's 1024 viewport = desktop).
const breakpoint = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: breakpoint.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

i18n.load('en', {});
i18n.activate('en');

const savingsRow: EarnProductRow = {
  id: 'savings',
  kind: 'savings',
  intent: Intent.SAVINGS_INTENT,
  name: 'Sky Savings Rate',
  tokenSymbol: 'sUSDS',
  supplyTokens: ['USDS', 'DAI', 'USDC'],
  risk: 'moderate',
  networks: [1],
  detailPath: '/earn/savings',
  rate: { value: 0.0375, formatted: '3.75%' },
  isLoading: false,
  error: null
};

// 2026-06-18T00:00:00Z
const fixedRow: EarnProductRow = {
  id: 'fixed-0xabc',
  kind: 'fixed',
  intent: Intent.FIXED_INTENT,
  name: 'Pendle sUSDS',
  tokenSymbol: 'sUSDS',
  supplyTokens: ['USDS', 'USDC', 'sUSDS'],
  risk: 'moderate',
  networks: [1],
  detailPath: '/earn/fixed/susds',
  maturity: 1781740800,
  rate: { value: 0.05, formatted: '5.00%' },
  isLoading: false,
  error: null
};

/** The shipped descriptor list with per-product `visible` overridden. */
const withVisibility = (visibility: Record<string, boolean>) =>
  HIGHLIGHTED_PRODUCTS.map(product => ({
    ...product,
    visible: visibility[product.id] ?? product.visible
  }));

const renderCards = (
  rows: EarnProductRow[] = [savingsRow, fixedRow],
  onSelect = vi.fn(),
  products?: typeof HIGHLIGHTED_PRODUCTS
) => {
  render(
    <I18nProvider i18n={i18n}>
      <EarnFeaturedCards rows={rows} onSelect={onSelect} products={products} />
    </I18nProvider>
  );
  return onSelect;
};

describe('EarnFeaturedCards — mobile featured products (M6.2, comp 486:22051)', () => {
  beforeEach(() => {
    breakpoint.isMobile = true;
  });
  afterEach(() => {
    breakpoint.isMobile = false;
    cleanup();
  });

  it('renders the single highlighted Sky Savings card with the live rate and a working Supply CTA', () => {
    const onSelect = renderCards([savingsRow, fixedRow], vi.fn(), withVisibility({ fixed: false }));

    expect(screen.getByText('Sky Savings')).toBeTruthy();
    expect(screen.getByText('3.75%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));
    expect(onSelect).toHaveBeenCalledWith('savings');
  });

  it('hides products whose descriptor is not visible (1036:201301)', () => {
    renderCards([savingsRow, fixedRow], vi.fn(), withVisibility({ fixed: false }));

    expect(screen.queryByText('Pendle sUSDS')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Supply' })).toHaveLength(1);
  });

  it('renders the Pendle fixed-yield card with maturity stat when its descriptor is visible', () => {
    const onSelect = renderCards([savingsRow, fixedRow], vi.fn(), withVisibility({ fixed: true }));

    expect(screen.getByText('Pendle sUSDS')).toBeTruthy();
    expect(screen.getByText('Maturity date')).toBeTruthy();
    expect(screen.getByText('18 Jun 2026')).toBeTruthy();
    expect(screen.getByText('5.00%')).toBeTruthy();

    const supplyButtons = screen.getAllByRole('button', { name: 'Supply' });
    expect(supplyButtons).toHaveLength(2);
    fireEvent.click(supplyButtons[1]);
    expect(onSelect).toHaveBeenCalledWith('fixed-0xabc');
  });

  it('can highlight the fixed-yield product alone', () => {
    renderCards([savingsRow, fixedRow], vi.fn(), withVisibility({ savings: false, fixed: true }));

    expect(screen.queryByText('Sky Savings')).toBeNull();
    expect(screen.getByText('Pendle sUSDS')).toBeTruthy();
  });

  it('skips a visible product whose marketplace row is absent', () => {
    renderCards([savingsRow], vi.fn(), withVisibility({ fixed: true }));

    expect(screen.getByText('Sky Savings')).toBeTruthy();
    expect(screen.queryByText('Pendle sUSDS')).toBeNull();
  });

  it('renders nothing when no visible product has a row', () => {
    renderCards([fixedRow], vi.fn(), withVisibility({ fixed: false }));

    expect(screen.queryByTestId('earn-featured-cards')).toBeNull();
  });
});

describe('EarnFeaturedCards — desktop (APP-395)', () => {
  afterEach(cleanup);

  it('renders the full-width horizontal savings card with an Earn CTA when it is the only visible card (1036:201301)', () => {
    const onSelect = renderCards([savingsRow, fixedRow], vi.fn(), withVisibility({ fixed: false }));

    expect(screen.getByTestId('earn-featured-savings-wide')).toBeTruthy();
    // The rate renders inside the "Supply … and earn {rate} APY" headline.
    expect(screen.getByText('3.75%')).toBeTruthy();
    expect(screen.getByText('TVL')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Earn' }));
    expect(onSelect).toHaveBeenCalledWith('savings');
  });

  it('renders two vertical cards with Earn CTAs when both products are visible (1036:201228)', () => {
    const onSelect = renderCards([savingsRow, fixedRow], vi.fn(), withVisibility({ fixed: true }));

    expect(screen.queryByTestId('earn-featured-savings-wide')).toBeNull();
    expect(screen.getByTestId('earn-featured-savings')).toBeTruthy();
    expect(screen.getByTestId('earn-featured-fixed')).toBeTruthy();

    const earnButtons = screen.getAllByRole('button', { name: 'Earn' });
    expect(earnButtons).toHaveLength(2);
    fireEvent.click(earnButtons[1]);
    expect(onSelect).toHaveBeenCalledWith('fixed-0xabc');
  });

  it('falls back to the vertical card when the only visible product has no wide treatment', () => {
    renderCards([savingsRow, fixedRow], vi.fn(), withVisibility({ savings: false, fixed: true }));

    expect(screen.queryByTestId('earn-featured-savings-wide')).toBeNull();
    expect(screen.getByTestId('earn-featured-fixed')).toBeTruthy();
  });
});
