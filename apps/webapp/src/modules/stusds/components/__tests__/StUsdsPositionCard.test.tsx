import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({
  connected: true,
  suppliedUsds: 0n as bigint
}));

const openSupply = vi.fn();
const openWithdraw = vi.fn();

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useConnection: () => ({
      address: h.connected ? '0x000000000000000000000000000000000000beef' : undefined,
      isConnected: h.connected
    })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStUsdsData: () => ({
      data: {
        userUsdsBalance: 30_000n * 10n ** 18n,
        userSuppliedUsds: h.suppliedUsds,
        userStUsdsBalance: h.suppliedUsds,
        // Per-second RAY rate ≈ 5% APY.
        moduleRate: 1000000001547125957863212448n
      },
      mutate: () => undefined
    })
  };
});

vi.mock('../../hooks/useStUsdsModal', () => ({
  useStUsdsModal: () => ({ openSupply, openWithdraw })
}));

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

import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';
import { ConnectModalProvider } from '@/modules/ui/context/ConnectModalContext';
import { ConnectThenActProvider, CONTINUATION_DELAY_MS } from '@/modules/ui/context/ConnectThenActContext';
import { StUsdsPositionCard } from '../StUsdsPositionCard';

const wrap = () => (
  <I18nProvider i18n={i18n}>
    <AnalyticsFlowProvider>
      <ConnectModalProvider>
        <ConnectThenActProvider>
          <StUsdsPositionCard />
        </ConnectThenActProvider>
      </ConnectModalProvider>
    </AnalyticsFlowProvider>
  </I18nProvider>
);

describe('StUsdsPositionCard — no-position entry card', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    h.connected = true;
    h.suppliedUsds = 0n;
  });

  it('opens the supply modal from the CTA when connected', () => {
    render(wrap());

    fireEvent.click(screen.getByTestId('stusds-supply-cta'));

    expect(openSupply).toHaveBeenCalledTimes(1);
  });

  it('keeps the CTA enabled while disconnected and routes the click into the connect flow', () => {
    vi.useFakeTimers();
    h.connected = false;
    const view = render(wrap());

    expect((screen.getByTestId('stusds-supply-cta') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('stusds-supply-cta'));
    expect(openSupply).not.toHaveBeenCalled();
    expect(screen.getByTestId('connect-modal-stub')).toBeTruthy();

    h.connected = true;
    view.rerender(wrap());
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS));
    expect(openSupply).toHaveBeenCalledTimes(1);
  });
});
