import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chainId as chainIdMap } from '@/utils/chainId';

// Chain resolution on a module route: which wallet switches the app asks for,
// and which redirects it makes. Every bug this file pins came in from the same
// direction — a wallet parked on a chain the app doesn't configure, which wagmi
// refuses to move `config.state.chainId` onto, so the app keeps reading against
// the last configured chain while the wallet is somewhere else. That state used
// to sit behind a blocking dialog; it is reachable now.
//
// The rule the tests below encode: a wallet chain change NEVER asks for the
// chain back, because changing network is a deliberate act. Navigating to a
// module that needs a chain does.

const TENDERLY: number = chainIdMap.tenderly;
const BASE = 8453; // configured, so a switch to it goes through `network=`
const POLYGON = 137; // configured by nothing here — the off-config case

const CHAINS = [
  { id: TENDERLY, name: 'Tenderly Mainnet' },
  { id: BASE, name: 'Tenderly Base' }
];

// Mutable per-test state the mocked hooks read through. vi.mock is hoisted, so
// module-level lets are the way to vary a mocked hook between renders.
let mockPathname = '/earn';
let mockConfigChainId = TENDERLY;
let mockWalletChainId: number | undefined = TENDERLY;
let mockFilterChainId: number | null = null;
let mockRewardContracts: { contractAddress: string }[] | undefined = [];

const mockNavigate = vi.fn();
const mockSwitchChain = vi.fn();
let switchMutation: { onSuccess?: () => void; onError?: () => void } = {};

// A stand-in for the connector's event emitter, which is how a wallet-side
// chain change reaches the app.
type Handler = (data: { chainId?: number }) => void;
const listeners = new Set<Handler>();
const emitter = {
  on: (_e: string, fn: Handler) => listeners.add(fn),
  off: (_e: string, fn: Handler) => listeners.delete(fn)
};
function walletEmitsChainChange(chainId: number) {
  mockWalletChainId = chainId;
  if (CHAINS.some(c => c.id === chainId)) mockConfigChainId = chainId;
  listeners.forEach(fn => fn({ chainId }));
}

// A real URLSearchParams so `network=` behaves as it does in the app: the
// route guard writes it and a separate effect reads it back to switch.
let search = new URLSearchParams();
const setSearchParams = vi.fn((updater: (p: URLSearchParams) => URLSearchParams) => {
  search = new URLSearchParams(updater(new URLSearchParams(search)));
});

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: mockPathname } })
}));
vi.mock('@/lib/navigation', () => ({
  keepSearch: (prev: Record<string, string>) => prev,
  useAppSearchParams: () => [search, setSearchParams],
  useRouteEntityParams: () => ({ rewardContract: undefined })
}));
vi.mock('wagmi', () => ({
  useChainId: () => mockConfigChainId,
  useChains: () => CHAINS,
  useConnection: () => ({ connector: { emitter }, chainId: mockWalletChainId }),
  useConnectionEffect: () => {},
  useSwitchChain: ({ mutation }: { mutation: typeof switchMutation }) => {
    switchMutation = mutation;
    return { switchChain: mockSwitchChain };
  }
}));
vi.mock('@/hooks', () => ({
  useNetworkFilter: () => ({ chainId: mockFilterChainId }),
  useAvailableTokenRewardContracts: () => mockRewardContracts
}));

// Everything below is orchestration the chain rules don't touch.
vi.mock('@/modules/utils/validateSearchParams', () => ({
  validateSearchParams: (p: URLSearchParams) => p
}));
vi.mock('@/modules/ui/context/ConnectedContext', () => ({
  useConnectedContext: () => ({ isAuthorized: true })
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ closeOnNavigation: vi.fn() })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ setIsSwitchingNetwork: vi.fn(), setIsAutoSwitching: vi.fn() })
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({ trackNetworkAutoSwitched: vi.fn() })
}));
vi.mock('@/modules/analytics/lib/trackRouteRedirected', () => ({ trackRouteRedirected: vi.fn() }));
vi.mock('./useSafeAppNotification', () => ({ useSafeAppNotification: () => {} }));
vi.mock('./useGovernanceMigrationToast', () => ({ useGovernanceMigrationToast: () => {} }));
vi.mock('./useSpkStakingRewardsToast', () => ({ useSpkStakingRewardsToast: () => {} }));
vi.mock('./useUsdsSkyRewardsToast', () => ({ useUsdsSkyRewardsToast: () => {} }));
vi.mock('./useSealEnginePositionToast', () => ({ useSealEnginePositionToast: () => {} }));
vi.mock('./useNotificationQueue', () => ({
  useNotificationQueue: () => ({ shouldShowNotification: () => false })
}));
vi.mock('./usePageLoadNotifications', () => ({ usePageLoadNotifications: () => [] }));
vi.mock('@/modules/upgrade/hooks/useUpgradeDeepLink', () => ({ useUpgradeDeepLink: () => {} }));

const { useAppOrchestration } = await import('./useAppOrchestration');

function Probe() {
  useAppOrchestration();
  return null;
}

/** Mounts the hook and returns a `refresh` that re-renders it in place. */
function mount() {
  // A fresh element each time: React bails out of a re-render given the same
  // reference, and these tests change module-level state between renders.
  const tree = () => <Probe />;
  const result = render(tree());
  return { refresh: () => result.rerender(tree()) };
}

const redirectedHome = () =>
  mockNavigate.mock.calls.some(([arg]) => (arg as { to: string }).to === '/portfolio');

beforeEach(() => {
  mockPathname = '/earn';
  mockConfigChainId = TENDERLY;
  mockWalletChainId = TENDERLY;
  mockFilterChainId = null;
  mockRewardContracts = [];
  search = new URLSearchParams();
  listeners.clear();
  switchMutation = {};
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useAppOrchestration — chain resolution', () => {
  it('asks for nothing when the wallet moves to an unconfigured chain on /earn', () => {
    const { refresh } = mount();
    mockSwitchChain.mockClear();
    mockNavigate.mockClear();

    walletEmitsChainChange(POLYGON);
    refresh();

    // Changing network is deliberate. The app neither argues with it...
    expect(mockSwitchChain).not.toHaveBeenCalled();
    // ...nor throws the user off a surface that runs on any chain.
    expect(redirectedHome()).toBe(false);
  });

  it('asks for a supported chain when the user then navigates to a mainnet-only module', () => {
    const { refresh } = mount();
    walletEmitsChainChange(POLYGON);
    refresh();
    mockSwitchChain.mockClear();
    mockNavigate.mockClear();

    // The user asks for a product — that is what earns the prompt.
    mockPathname = '/earn/rewards/0xabc';
    refresh();

    expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: TENDERLY });
    expect(redirectedHome()).toBe(false);
  });

  it('holds the module route while that switch is in flight', () => {
    const { refresh } = mount();
    walletEmitsChainChange(POLYGON);
    refresh();
    mockPathname = '/earn/rewards/0xabc';
    refresh();
    expect(mockSwitchChain).toHaveBeenCalledTimes(1);
    mockNavigate.mockClear();

    // An unrelated query settles while the wallet is still deciding. Without a
    // pending target to validate against, this re-render sees the chain being
    // LEFT, finds the visit's switch chance spent, and bounces home a beat
    // before the wallet answers — the "page flashes, then Portfolio" report.
    mockRewardContracts = [{ contractAddress: '0xabc' }];
    refresh();

    expect(redirectedHome()).toBe(false);
  });

  it('redirects home, without asking for a chain, when the wallet leaves a module mid-visit', () => {
    mockPathname = '/stake';
    const { refresh } = mount();
    mockSwitchChain.mockClear();
    mockNavigate.mockClear();

    walletEmitsChainChange(POLYGON);
    refresh();

    // Stake cannot run there, so the route gives way...
    expect(redirectedHome()).toBe(true);
    // ...and that is the whole response. Asking for the chain back would be the
    // prompt the redirect just declined to make, and the Portfolio it lands on
    // has no use for it. (The intent changes on arrival, which resets the
    // visit's switch chance — so nothing else would stop it.)
    mockPathname = '/portfolio';
    refresh();
    expect(mockSwitchChain).not.toHaveBeenCalled();
  });

  it('does not re-ask after the user declines the switch, and gives way instead', () => {
    // Landing on a mainnet-only module with the wallet already off-config: the
    // arrival is the ask, so this one does prompt.
    mockPathname = '/stake';
    mockWalletChainId = POLYGON;
    const { refresh } = mount();
    expect(mockSwitchChain).toHaveBeenCalledTimes(1);
    mockNavigate.mockClear();

    switchMutation.onError?.(); // the user declines
    mockSwitchChain.mockClear();
    refresh();

    // One prompt per visit: the wallet is where the user wants it, and the
    // route gives way rather than asking twice.
    expect(mockSwitchChain).not.toHaveBeenCalled();
    expect(redirectedHome()).toBe(true);
  });
});
