/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendleMarketConfig } from '@/hooks';
import type { PositionEarnings } from '@/modules/portfolio/earnings/earningsForPosition';

i18n.load('en', {});
i18n.activate('en');

const MARKET: PendleMarketConfig = {
  name: 'Fixed Yield',
  slug: 'pt-susds',
  marketAddress: '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc',
  ptToken: '0xdc169abe56461a2e0c034da431ac2a3ebf596094',
  ytToken: '0xc7b8551c6b286ce0b44952320e940bd3dee58a09',
  syToken: '0xbe3d4ec488a0a042bb86f9176c24f8cd54018ba7',
  underlyingToken: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD',
  underlyingSymbol: 'sUSDS',
  underlyingDecimals: 18,
  expiry: 1781740800, // 18 Jun 2026 — matured
  usdsEquivalence: 'pegged'
};

const h = vi.hoisted(() => ({
  chainId: 1,
  switchBlocked: false
}));

const openRedeemModal = vi.fn();
const onViewDetails = vi.fn();

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => h.chainId };
});

vi.mock('../../hooks/usePendleRedeemModal', () => ({
  usePendleRedeemModal: () => ({
    openRedeemModal,
    isRedeemable: true,
    switchBlocked: h.switchBlocked,
    ptBalance: 0n
  })
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils')>();
  return { ...actual, getChainIcon: () => null };
});

import { PendleMaturedPositionCard } from '../PendleMaturedPositionCard';

const PT_BALANCE = 100_184n * 10n ** 18n;

const ACCRUED: PositionEarnings = {
  totalEarned: { status: 'ok', value: { usd: 184.8, native: { amount: 184.8, symbol: 'USDS' } } },
  earnedThisMonth: { status: 'ok', value: { usd: 0 } },
  missingFromTotal: [],
  missingFromMonth: []
};

const renderCard = (accrued: PositionEarnings | null = ACCRUED) =>
  render(
    <I18nProvider i18n={i18n}>
      <PendleMaturedPositionCard
        market={MARKET}
        ptBalance={PT_BALANCE}
        accrued={accrued}
        onViewDetails={onViewDetails}
      />
    </I18nProvider>
  );

describe('PendleMaturedPositionCard', () => {
  beforeEach(() => {
    h.chainId = 1;
    h.switchBlocked = false;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the matured badge, the PT balance as the claim and the ready-to-claim copy', () => {
    renderCard();

    const card = screen.getByTestId('pendle-matured-position-card');
    expect(screen.getByTestId('pendle-matured-badge').textContent).toContain('Matured');
    expect(card.textContent).toContain('Fixed Yield');
    expect(card.textContent).toContain("You'll claim");
    expect(card.textContent).toContain('100,184');
    expect(card.textContent).toContain('Your position matured on 18 Jun 2026 and is ready to claim.');
  });

  it('shows the accrued figure from the wallet earnings slice', () => {
    renderCard();

    expect(screen.getByTestId('pendle-matured-accrued').textContent).toContain('184.8');
  });

  it('opens the redeem modal from Claim', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('pendle-matured-redeem-button'));
    expect(openRedeemModal).toHaveBeenCalledTimes(1);
  });

  it('routes to the market page from View details — the siblings’ Manage slot', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('pendle-matured-view-details'));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('keeps Claim enabled off the pendle chain — the click switches the wallet first', () => {
    h.chainId = 8453; // Base
    renderCard();

    expect((screen.getByTestId('pendle-matured-redeem-button') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('pendle-redeem-network-hint')).toBeNull();
  });

  it('disables Claim off-chain in a Safe and explains why, leaving View details usable', () => {
    h.chainId = 8453;
    h.switchBlocked = true; // the dapp must not switch a Safe (APP-486)
    renderCard();

    expect((screen.getByTestId('pendle-matured-redeem-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('pendle-redeem-network-hint').textContent).toContain('Safe app');
    // Reading the market never depended on the wallet's chain.
    expect((screen.getByTestId('pendle-matured-view-details') as HTMLButtonElement).disabled).toBe(false);
  });
});
