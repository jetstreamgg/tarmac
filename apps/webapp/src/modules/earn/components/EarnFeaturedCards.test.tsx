import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';
import type { EarnProductRow } from '@/hooks';
import { EarnFeaturedCards } from './EarnFeaturedCards';

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

const renderCards = (rows: EarnProductRow[] = [savingsRow, fixedRow], onSelect = vi.fn()) => {
  render(
    <I18nProvider i18n={i18n}>
      <EarnFeaturedCards rows={rows} onSelect={onSelect} />
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
    const onSelect = renderCards();

    expect(screen.getByText('Sky Savings')).toBeTruthy();
    expect(screen.getByText('3.75%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));
    expect(onSelect).toHaveBeenCalledWith('savings');
  });

  it('highlights only one product — no Pendle card even when a fixed row exists (1036:201301)', () => {
    renderCards();

    expect(screen.queryByText('Pendle sUSDS')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Supply' })).toHaveLength(1);
  });

  it('renders nothing when the savings row is absent', () => {
    renderCards([fixedRow]);

    expect(screen.queryByTestId('earn-featured-cards')).toBeNull();
  });
});

describe('EarnFeaturedCards — desktop', () => {
  afterEach(cleanup);

  it('renders nothing at md and above (desktop unchanged per AC)', () => {
    renderCards();

    expect(screen.queryByTestId('earn-featured-cards')).toBeNull();
  });
});
