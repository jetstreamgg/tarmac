import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    useOverallSkyData: () => ({ data: { skySavingsRatecRate: '0.0375' } }),
    useTokenBalances: () => ({
      data: [
        { symbol: 'USDS', formatted: '20000', value: 0n, decimals: 18, chainId: 1 },
        { symbol: 'DAI', formatted: '10000', value: 0n, decimals: 18, chainId: 1 }
      ],
      isLoading: false
    })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { SavingsSupplyCard } from './SavingsSupplyCard';

const renderCard = (onSupply = vi.fn()) => {
  render(
    <I18nProvider i18n={i18n}>
      <SavingsSupplyCard onSupply={onSupply} />
    </I18nProvider>
  );
  return onSupply;
};

describe('SavingsSupplyCard — no-position entry card', () => {
  afterEach(() => {
    cleanup();
    h.chainId = 1;
    h.connected = true;
  });

  it('renders the rate, aggregated idle balance, and the chain-aware supply tokens', () => {
    renderCard();

    expect(screen.getByTestId('savings-supply-card')).toBeTruthy();
    // Current rate from useOverallSkyData (decimal fraction → percentage).
    expect(screen.getAllByText('3.75%').length).toBeGreaterThan(0);
    // Idle balance = sum of the supply origins' wallet balances (20k + 10k).
    expect(screen.getByText('30,000')).toBeTruthy();
    // Mainnet supply origins are USDS + DAI (no inline input, just labels).
    expect(screen.getAllByText('USDS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DAI').length).toBeGreaterThan(0);
    // No inline amount input — entry happens in the modal.
    expect(screen.queryByTestId('savings-amount-input')).toBeNull();
  });

  it('opens the supply modal via onSupply when the CTA is clicked', () => {
    const onSupply = renderCard();

    fireEvent.click(screen.getByTestId('savings-supply-cta'));

    expect(onSupply).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA and dashes the idle balance when disconnected', () => {
    h.connected = false;
    renderCard();

    expect((screen.getByTestId('savings-supply-cta') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('–')).toBeTruthy();
  });
});
