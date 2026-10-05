import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';
import { NetworkSwitchProvider, useNetworkSwitch, useTargetChainId } from './NetworkSwitchContext';

// `canSwitchChain` is the one place the app decides whether it may ask the
// wallet to switch at all; every switch surface reads it. The Safe cases are
// the point: the Safe App connector has no `switchChain`, and a Safe over
// WalletConnect must not be asked either (APP-486, APP-566).

const mocks = vi.hoisted(() => ({
  connector: undefined as { switchChain?: () => void; name?: string } | undefined,
  isSafeWallet: false,
  switchChain: vi.fn(),
  walletChainId: undefined as number | undefined
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useSwitchChain: () => ({ switchChain: mocks.switchChain, isPending: false, variables: undefined }),
  useConnection: () => ({ connector: mocks.connector, chainId: mocks.walletChainId }),
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
  mocks.walletChainId = 1;
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

// The route guard's pending switch, shared so the reward route resolves its
// contract against the same chain the guard judges (APP-591).
describe('pendingSwitch / useTargetChainId', () => {
  // Stake runs on mainnet only, so it can wait on a switch to 1 but not to Base.
  const renderBoth = (intent: Intent = Intent.STAKE_INTENT) =>
    renderHook(() => ({ ...useNetworkSwitch(), target: useTargetChainId(intent) }), { wrapper });

  it('points at the wallet chain with nothing pending, and at the target while a switch waits', () => {
    mocks.walletChainId = 137; // off-config: the app names the wallet's chain
    const { result } = renderBoth();
    expect(result.current.target).toBe(137);

    act(() => result.current.setPendingSwitch({ from: 137, to: 1 }));
    expect(result.current.target).toBe(1);
  });

  it("points at the wallet's chain while the route's module can't run on the target", () => {
    // Before the navigation's release of the switch lands: the new module's
    // first render must not be judged against a target it can't use.
    mocks.walletChainId = 1;
    const { result } = renderBoth();
    act(() => result.current.setPendingSwitch({ from: 1, to: 8453 }));
    expect(result.current.pendingSwitch).toEqual({ from: 1, to: 8453 });
    expect(result.current.target).toBe(1);

    expect(renderBoth(Intent.SAVINGS_INTENT).result.current.target).toBe(1); // nothing pending here
  });

  it('ends the wait when the wallet moves anywhere, not only to the target', () => {
    mocks.walletChainId = 137;
    const { result, rerender } = renderBoth();
    act(() => result.current.setPendingSwitch({ from: 137, to: 1 }));

    mocks.walletChainId = 8453;
    rerender();
    expect(result.current.pendingSwitch).toBeUndefined();
  });

  it('ends the wait on a disconnect', () => {
    mocks.walletChainId = 137;
    const { result, rerender } = renderBoth();
    act(() => result.current.setPendingSwitch({ from: 137, to: 1 }));

    mocks.walletChainId = undefined;
    rerender();
    expect(result.current.pendingSwitch).toBeUndefined();
  });
});
