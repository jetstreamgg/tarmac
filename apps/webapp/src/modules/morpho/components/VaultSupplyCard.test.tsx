import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Token } from '@/hooks';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

const h = vi.hoisted(() => ({ chainId: 1, connected: true }));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => h.chainId,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: h.connected, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    getTokenDecimals: () => 6,
    useTokenBalance: () => ({ data: { value: 1_000_000_000n, decimals: 6 } })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

vi.mock('@/modules/ui/context/ConnectedContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/ui/context/ConnectedContext')>();
  return {
    ...actual,
    useConnectedContext: () => ({ isConnectedAndAcceptedTerms: h.connected })
  };
});

vi.mock('@/modules/ui/components/ConnectModal', () => ({
  ConnectModal: () => <div data-testid="connect-modal-stub" />
}));

import { ConnectModalProvider } from '@/modules/ui/context/ConnectModalContext';
import { ConnectThenActProvider, CONTINUATION_DELAY_MS } from '@/modules/ui/context/ConnectThenActContext';
import { VaultSupplyCard } from './VaultSupplyCard';

const usdt = { symbol: 'USDT', name: 'Tether USD', address: { 1: '0x0' } } as unknown as Token;

const wrap = (onSupply: () => void) => (
  <I18nProvider i18n={i18n}>
    <ConnectModalProvider>
      <ConnectThenActProvider>
        <VaultSupplyCard assetToken={usdt} netRate={0.0276} onSupply={onSupply} />
      </ConnectThenActProvider>
    </ConnectModalProvider>
  </I18nProvider>
);

describe('VaultSupplyCard — no-position entry card', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    h.chainId = 1;
    h.connected = true;
  });

  it('opens the supply modal via onSupply when connected', () => {
    const onSupply = vi.fn();
    render(wrap(onSupply));

    fireEvent.click(screen.getByTestId('vault-supply-cta'));

    expect(onSupply).toHaveBeenCalledTimes(1);
  });

  it('keeps the CTA enabled while disconnected and routes the click into the connect flow', () => {
    vi.useFakeTimers();
    h.connected = false;
    const onSupply = vi.fn();
    const view = render(wrap(onSupply));

    expect((screen.getByTestId('vault-supply-cta') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('vault-supply-cta'));
    expect(onSupply).not.toHaveBeenCalled();
    expect(screen.getByTestId('connect-modal-stub')).toBeTruthy();

    h.connected = true;
    view.rerender(wrap(onSupply));
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS));
    expect(onSupply).toHaveBeenCalledTimes(1);
  });
});
