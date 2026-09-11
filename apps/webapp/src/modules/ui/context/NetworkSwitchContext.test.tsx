import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkSwitchProvider, useNetworkSwitch } from './NetworkSwitchContext';

// `canSwitchChain` is the one place the app decides whether it may ask the
// wallet to switch at all; every switch surface reads it. The Safe cases are
// the point: the Safe App connector has no `switchChain`, and a Safe over
// WalletConnect must not be asked either (APP-486, APP-566).

const mocks = vi.hoisted(() => ({
  connector: undefined as { switchChain?: () => void; name?: string } | undefined,
  isSafeWallet: false,
  switchChain: vi.fn()
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useSwitchChain: () => ({ switchChain: mocks.switchChain, isPending: false, variables: undefined }),
  useConnection: () => ({ connector: mocks.connector }),
  useChains: () => [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' }
  ],
  useChainId: () => 1
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => mocks.isSafeWallet
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({ trackNetworkSwitchRequested: vi.fn(), trackNetworkSwitchCompleted: vi.fn() })
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <NetworkSwitchProvider>{children}</NetworkSwitchProvider>
);
const render = () => renderHook(() => useNetworkSwitch(), { wrapper });

beforeEach(() => {
  mocks.connector = { switchChain: () => undefined, name: 'MetaMask' };
  mocks.isSafeWallet = false;
  mocks.switchChain.mockClear();
});

describe('canSwitchChain', () => {
  it('is on for a wallet whose connector can switch', () => {
    expect(render().result.current.canSwitchChain).toBe(true);
  });

  it('is off for a connector without switchChain (the Safe App iframe)', () => {
    mocks.connector = { name: 'Safe' };
    expect(render().result.current.canSwitchChain).toBe(false);
  });

  it('is off for a Safe over a connector that could switch (WalletConnect)', () => {
    mocks.connector = { switchChain: () => undefined, name: 'WalletConnect' };
    mocks.isSafeWallet = true;
    expect(render().result.current.canSwitchChain).toBe(false);
  });

  it('withholds nothing while disconnected', () => {
    mocks.connector = undefined;
    expect(render().result.current.canSwitchChain).toBe(true);
  });

  it('makes handleSwitchChain a no-op when the dapp must not switch', () => {
    mocks.isSafeWallet = true;
    const { result } = render();
    act(() => result.current.handleSwitchChain({ chainId: 8453 }));
    expect(mocks.switchChain).not.toHaveBeenCalled();

    mocks.isSafeWallet = false;
    const ok = render();
    act(() => ok.result.current.handleSwitchChain({ chainId: 8453 }));
    expect(mocks.switchChain).toHaveBeenCalledTimes(1);
  });
});
