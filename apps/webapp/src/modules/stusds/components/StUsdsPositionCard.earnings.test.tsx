import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Mutable supplied balance drives which card renders; the earnings holder
// hands the card a literal APP-450 slice (the aggregator has its own suite).
const h = vi.hoisted(() => ({ suppliedUsds: 0n as bigint }));
const earningsHolder = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useConnection: () => ({ address: '0x1', isConnected: true, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStUsdsData: () => ({
      data: { userSuppliedUsds: h.suppliedUsds, moduleRate: 0n },
      mutate: vi.fn()
    })
  };
});

vi.mock('../hooks/useStUsdsModal', () => ({
  useStUsdsModal: () => ({ openSupply: vi.fn(), openWithdraw: vi.fn() })
}));
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({
  useConnectThenAct: (fn: () => void) => fn
}));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/portfolio/hooks/useWalletEarnings', () => ({
  useWalletEarnings: () => earningsHolder.value
}));

import { combineWalletEarnings } from '@/modules/portfolio/earnings/combineWalletEarnings';
import {
  notAvailable,
  ok,
  type ProtocolEarnings,
  type WalletEarnings
} from '@/modules/portfolio/earnings/types';
import { StUsdsPositionCard } from './StUsdsPositionCard';

const stusdsEarnings = (totalEarned: ProtocolEarnings['totalEarned']): WalletEarnings => {
  const protocols: ProtocolEarnings[] = [
    {
      id: 'stusds',
      rowIds: ['stusds'],
      totalEarned,
      earnedThisMonth: totalEarned,
      isLoading: false,
      error: null
    }
  ];
  return {
    protocols,
    combined: combineWalletEarnings(protocols),
    isLoading: false,
    window: { startSec: 0, endSec: 0 }
  };
};

const renderCard = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StUsdsPositionCard />
    </I18nProvider>
  );

describe('StUsdsPositionCard — accrued to date (APP-450)', () => {
  beforeEach(() => {
    h.suppliedUsds = 100n * 10n ** 18n;
    earningsHolder.value = stusdsEarnings(ok({ usd: 30 }));
  });
  afterEach(() => cleanup());

  it('renders the accrued-to-date figure', () => {
    renderCard();

    expect(screen.getByTestId('stusds-accrued-to-date').textContent).toContain('$30.00');
  });

  it('renders a self-explaining dash when the stUSDS figure is unavailable', () => {
    earningsHolder.value = stusdsEarnings(notAvailable('source-error'));
    renderCard();

    expect(screen.getByTestId('stusds-accrued-to-date').textContent).toBe('—');
  });
});
