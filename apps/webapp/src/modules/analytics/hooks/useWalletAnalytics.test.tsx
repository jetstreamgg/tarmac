import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsFlowProvider } from '../context/AnalyticsFlowContext';
import { useWalletAnalytics } from './useWalletAnalytics';
import { capturedEventsNamed, clearCapturedEvents, lastCapturedEvent } from '@/test/analyticsCapture';

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});

type ConnectData = { address: string; connector?: { name: string }; isReconnected: boolean };
const wagmiHarness = vi.hoisted(() => ({
  onConnect: undefined as ((data: ConnectData) => void) | undefined,
  onDisconnect: undefined as (() => void) | undefined
}));
vi.mock('wagmi', () => ({
  useConnection: () => ({ address: undefined }),
  useChains: () => [{ id: 1, name: 'Ethereum' }],
  useConnectionEffect: (config: { onConnect?: (data: ConnectData) => void; onDisconnect?: () => void }) => {
    wagmiHarness.onConnect = config.onConnect;
    wagmiHarness.onDisconnect = config.onDisconnect;
  }
}));

const renderWalletAnalytics = () =>
  renderHook(() => useWalletAnalytics(), { wrapper: AnalyticsFlowProvider });

const connect = (isReconnected: boolean, name = 'MetaMask') =>
  act(() => wagmiHarness.onConnect?.({ address: '0x1', connector: { name }, isReconnected }));

describe('useWalletAnalytics', () => {
  beforeEach(() => clearCapturedEvents());

  it('fires app_wallet_connected on a user-initiated connect', () => {
    renderWalletAnalytics();
    connect(false);
    const captured = lastCapturedEvent('app_wallet_connected');
    expect(captured?.properties).toMatchObject({ wallet_name: 'MetaMask' });
    expect(captured?.properties.flow_id).toBeTruthy();
  });

  it('stays silent on wagmi auto-reconnect (page refresh must not read as a connect)', () => {
    renderWalletAnalytics();
    connect(true);
    expect(capturedEventsNamed('app_wallet_connected')).toHaveLength(0);
  });

  it('names the disconnect after the last connected wallet, reconnects included', () => {
    renderWalletAnalytics();
    connect(true, 'Rabby');
    act(() => wagmiHarness.onDisconnect?.());
    expect(lastCapturedEvent('app_wallet_disconnected')?.properties).toMatchObject({
      wallet_name: 'Rabby'
    });
  });

  it('falls back to unknown when a disconnect arrives before any connect', () => {
    renderWalletAnalytics();
    act(() => wagmiHarness.onDisconnect?.());
    expect(lastCapturedEvent('app_wallet_disconnected')?.properties).toMatchObject({
      wallet_name: 'unknown'
    });
  });
});
