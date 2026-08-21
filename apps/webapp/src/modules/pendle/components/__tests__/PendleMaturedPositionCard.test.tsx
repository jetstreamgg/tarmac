/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendleMarketConfig } from '@/hooks';

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
  earnings: { earnings: 184.8 as number | undefined, currency: 'USDS' as string | undefined },
  isPrepared: true
}));

const openRedeemModal = vi.fn();
const onViewDetails = vi.fn();

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => h.chainId };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    usePendleRedeemPreview: () => ({ data: undefined, isLoading: false }),
    usePendleMaturedPositionEarnings: () => h.earnings
  };
});

vi.mock('../../hooks/usePendleRedeemModal', () => ({
  usePendleRedeemModal: () => ({
    openRedeemModal,
    isRedeemable: true,
    isPrepared: h.isPrepared,
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

const renderCard = () =>
  render(
    <I18nProvider i18n={i18n}>
      <PendleMaturedPositionCard market={MARKET} ptBalance={PT_BALANCE} onViewDetails={onViewDetails} />
    </I18nProvider>
  );

describe('PendleMaturedPositionCard', () => {
  beforeEach(() => {
    h.chainId = 1;
    h.earnings = { earnings: 184.8, currency: 'USDS' };
    h.isPrepared = true;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the matured badge, position and ready-to-withdraw copy', () => {
    renderCard();

    const card = screen.getByTestId('pendle-matured-position-card');
    expect(screen.getByTestId('pendle-matured-badge').textContent).toContain('Matured');
    expect(card.textContent).toContain('Pendle sUSDS');
    expect(card.textContent).toContain('100,184');
    expect(card.textContent).toContain('18 Jun 2026');
    expect(card.textContent).toContain('184.8');
    expect(card.textContent).toContain('ready to withdraw');
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

  it('disables Claim off the pendle chain and explains why, leaving View details usable', () => {
    h.chainId = 8453; // Base
    renderCard();

    expect((screen.getByTestId('pendle-matured-redeem-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('pendle-redeem-network-hint')).toBeTruthy();
    // Reading the market never depended on the wallet's chain.
    expect((screen.getByTestId('pendle-matured-view-details') as HTMLButtonElement).disabled).toBe(false);
  });

  it('falls back to the deposit-only line when earnings are unavailable', () => {
    h.earnings = { earnings: undefined, currency: undefined };
    renderCard();

    const card = screen.getByTestId('pendle-matured-position-card');
    expect(card.textContent).toContain('Your deposit is ready to withdraw');
    expect(card.textContent).not.toContain('in yield');
  });
});
