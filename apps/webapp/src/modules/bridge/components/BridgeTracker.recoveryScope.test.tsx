/**
 * @vitest-environment happy-dom
 */
import type { ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletDrawerTabs } from '@/modules/app/shell/WalletDrawerTabs';
import { createPendingBridge } from '../model/pendingTransitions';
import { nativeWithdrawalRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { BridgePanel } from './BridgePanel';
import { BridgeTracker } from './BridgeTracker';

// A wallet that never bridged here costs no recovery scan while it uses the
// rest of the app, and a bridge is still found wherever bridges are shown.

const MINUTE = 60_000;
const L2S = 4;

const mocks = vi.hoisted(() => ({
  // One wallet per test: the store keeps its lists for the session.
  account: '',
  scope: '',
  deposits: vi.fn(),
  withdrawals: vi.fn(),
  tracker: vi.fn()
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}), useChains: () => [] }));
vi.mock('wagmi/actions', () => ({
  getPublicClient: () => ({ getBlockNumber: async () => 100n, getBlock: async () => ({ timestamp: 0n }) }),
  getCallsStatus: vi.fn()
}));
vi.mock('../hooks/usePendingScope', () => ({
  usePendingScope: () => ({ account: mocks.account, scope: mocks.scope, familyChainId: 1 })
}));
vi.mock('../hooks/adapterContext', () => ({
  wagmiAdapterContext: () => ({ getClient: () => ({ getBlockNumber: async () => 100n }) })
}));
vi.mock('../hooks/useBridgeTracker', () => ({ useBridgeTracker: mocks.tracker }));
vi.mock('../adapters/nativeDeposit/discovery', () => ({ discoverNativeDeposits: mocks.deposits }));
vi.mock('../adapters/nativeWithdrawal/discovery', () => ({ discoverNativeWithdrawals: mocks.withdrawals }));
vi.mock('../adapters/nativeWithdrawal/lookup', () => ({ lookupNativeWithdrawal: vi.fn() }));
vi.mock('../tracking/recoverDeposits', () => ({ recoverDeposits: vi.fn(async () => 0) }));
vi.mock('../tracking/recoverWithdrawals', () => ({ recoverWithdrawals: vi.fn(async () => 0) }));

// The Bridge tab and the wallet drawer, down to what shows the bridges.
vi.mock('../hooks/useBridgeForm', () => ({
  useBridgeForm: () => ({
    isConnected: true,
    reviewBlocked: true,
    refetchBalances: () => {},
    reset: () => {}
  })
}));
vi.mock('../hooks/useBridgeLaunch', () => ({
  useBridgeLaunch: () => ({ launch: vi.fn(), locked: false, restore: vi.fn() })
}));
vi.mock('../hooks/useDestinationActionLaunch', () => ({
  useDestinationActionLaunch: () => ({
    launch: vi.fn(),
    canLaunch: vi.fn(),
    actionHint: vi.fn(),
    locked: false
  })
}));
vi.mock('../hooks/useCctpResumeLaunch', () => ({ useCctpResumeLaunch: () => ({ launch: vi.fn() }) }));
vi.mock('../hooks/useCctpSwapConvertLaunch', () => ({
  useCctpSwapConvertLaunch: () => ({ launch: vi.fn() })
}));
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({ useConnectThenAct: (fn: () => void) => fn }));
vi.mock('./BridgeCard', () => ({ BridgeCard: () => null }));
vi.mock('./PendingBridges', () => ({ PendingBridges: () => null }));
vi.mock('./BridgeClaimLookup', () => ({ BridgeClaimLookup: () => null, hasBridgeClaimLookup: () => false }));
vi.mock('@/modules/app/shell/activity/BalancesHistory', () => ({ BalancesHistory: () => null }));
vi.mock('@/modules/app/shell/WalletDrawerAssets', () => ({ WalletDrawerAssets: () => null }));

const card = () =>
  createPendingBridge({
    account: mocks.account,
    amount: 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: nativeWithdrawalRoute('base'),
    txHash: `0x${'aa'.repeat(32)}`,
    now: Date.now()
  });

/** The app on a page: the shell's tracker, and what the page shows of the bridge. */
const app = (page: ReactNode = null) => (
  <I18nProvider i18n={i18n}>
    {/* The tracker comes first, as in the shell. */}
    <BridgeTracker />
    {page}
  </I18nProvider>
);
/** A page load: a fresh app with a fresh query cache. */
const load = async (page?: ReactNode) => {
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}>{app(page)}</QueryClientProvider>);
  await vi.advanceTimersByTimeAsync(0);
  return {
    /** A navigation inside the app: the shell stays, the page changes. */
    go: async (next?: ReactNode) => {
      view.rerender(<QueryClientProvider client={client}>{app(next)}</QueryClientProvider>);
      await vi.advanceTimersByTimeAsync(0);
    }
  };
};
const scans = () => ({
  deposits: mocks.deposits.mock.calls.length,
  l2s: mocks.withdrawals.mock.calls.length
});
const ONE = { deposits: 1, l2s: L2S };
const NONE = { deposits: 0, l2s: 0 };

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));
let wallets = 0;
beforeEach(() => {
  mocks.account = `0x${(++wallets).toString(16).padStart(40, '0')}`;
  mocks.scope = pendingScopeKey({ account: mocks.account, familyChainId: 1 });
  vi.useFakeTimers();
  localStorage.clear();
  mocks.deposits.mockReset().mockResolvedValue({ deposits: [], complete: true });
  mocks.withdrawals.mockReset().mockResolvedValue({ withdrawals: [], complete: true });
  mocks.tracker.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a wallet with no bridge in this browser, away from the Bridge tab', () => {
  it('is never scanned, however long it stays', async () => {
    await load();
    await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
    expect(scans()).toEqual(NONE);
  });

  it('still has its stored bridges tracked', async () => {
    await load();
    expect(mocks.tracker).toHaveBeenCalled();
  });
});

describe('a bridge is still looked for', () => {
  it('at once on the Bridge tab, then every 30 minutes', async () => {
    await load(<BridgePanel />);
    expect(scans()).toEqual(ONE);
    await vi.advanceTimersByTimeAsync(31 * MINUTE);
    expect(scans()).toEqual({ deposits: 2, l2s: 2 * L2S });
  });

  it('at once when the wallet drawer opens', async () => {
    const { go } = await load();
    expect(scans()).toEqual(NONE);
    await go(<WalletDrawerTabs />);
    expect(scans()).toEqual(ONE);
  });

  it('at once when the Bridge tab opens after another page', async () => {
    const { go } = await load();
    await vi.advanceTimersByTimeAsync(50 * MINUTE);
    await go(<BridgePanel />);
    expect(scans()).toEqual(ONE);
  });

  it('on every page, at the pace of today, once the wallet has a bridge here', async () => {
    pendingBridgeStore.upsert(mocks.scope, card());
    await load();
    expect(scans()).toEqual(ONE);
    await vi.advanceTimersByTimeAsync(31 * MINUTE);
    expect(scans()).toEqual({ deposits: 2, l2s: 2 * L2S });
  });

  it('on every page from the moment a bridge is stored', async () => {
    await load();
    pendingBridgeStore.upsert(mocks.scope, card());
    await vi.advanceTimersByTimeAsync(0);
    expect(scans()).toEqual(ONE);
  });
});

describe('leaving the Bridge tab and coming back', () => {
  it('never waits longer than the 30 minutes of today for the next scan', async () => {
    const { go } = await load(<BridgePanel />);
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    await go();
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    await go(<BridgePanel />);
    expect(scans()).toEqual(ONE);
    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    expect(scans()).toEqual({ deposits: 2, l2s: 2 * L2S });
  });

  it('scans at once when the last scan is older than that', async () => {
    const { go } = await load(<BridgePanel />);
    await go();
    await vi.advanceTimersByTimeAsync(45 * MINUTE);
    expect(scans()).toEqual(ONE);
    await go(<BridgePanel />);
    expect(scans()).toEqual({ deposits: 2, l2s: 2 * L2S });
  });

  it('makes no scan while away', async () => {
    const { go } = await load(<BridgePanel />);
    await go();
    await vi.advanceTimersByTimeAsync(3 * 60 * MINUTE);
    expect(scans()).toEqual(ONE);
  });
});

describe('the Bridge tab of a wallet with a bridge here', () => {
  it('is scanned once per interval, not once per place that asks', async () => {
    pendingBridgeStore.upsert(mocks.scope, card());
    await load(<BridgePanel />);
    await vi.advanceTimersByTimeAsync(31 * MINUTE);
    expect(scans()).toEqual({ deposits: 2, l2s: 2 * L2S });
  });
});
