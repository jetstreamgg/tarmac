import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';
import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';
import { usePortfolioSupplyActions } from './usePortfolioSupplyActions';
import type { SuppliedPosition } from '../helpers/suppliedView';

const h = vi.hoisted(() => ({
  openSavingsSupply: vi.fn(),
  openStUsdsSupply: vi.fn(),
  openVaultSupply: vi.fn(),
  openPendleSupply: vi.fn(),
  // Far-future expiry so the market reads as active; the maturity test flips it.
  pendleMarket: { name: 'PT-sUSDS', slug: 'pt-susds', marketAddress: '0x9C5', expiry: 4102444800 },
  openRewardsSupply: vi.fn(),
  chainId: 1,
  // Production-shaped chain list by default; the dev-build test adds the fork.
  chains: [{ id: 1 }, { id: 8453 }, { id: 10 }] as { id: number }[],
  // Geo modules disabled for the region; empty = unrestricted (the default).
  geoDisabledModules: new Set<string>(),
  isSafeWallet: false,
  switchChainAsync: vi.fn(),
  setIsAutoSwitching: vi.fn(),
  setAutoSwitchIntent: vi.fn()
}));

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});

vi.mock('wagmi', () => ({
  useChainId: () => h.chainId,
  useConnection: () => ({ address: undefined }),
  useChains: () => h.chains,
  useSwitchChain: () => ({ switchChainAsync: h.switchChainAsync })
}));

vi.mock('@/modules/geo-config/hooks/useGeoConfig', () => ({
  useGeoConfig: () => ({ isModuleEnabled: (moduleId: string) => !h.geoDisabledModules.has(moduleId) })
}));

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    setIsAutoSwitching: h.setIsAutoSwitching,
    setAutoSwitchIntent: h.setAutoSwitchIntent
  })
}));

vi.mock('@/hooks', () => ({
  TOKENS: { cle: { symbol: 'CLE' } },
  useIsSafeWallet: () => h.isSafeWallet,
  VAULTS: [
    {
      provider: 'morpho',
      name: 'USDC Risk Capital',
      vaultAddress: { 1: '0xABC' },
      assetToken: { symbol: 'USDC' }
    },
    { provider: 'sky', name: 'Tether Savings', vaultAddress: { 1: '0xDEF' }, assetToken: { symbol: 'USDT' } }
  ],
  getPendleMarketByAddress: (address: string) =>
    address.toLowerCase() === h.pendleMarket.marketAddress.toLowerCase() ? h.pendleMarket : undefined,
  isMarketMatured: (expiry: number) => expiry * 1000 <= Date.now(),
  // Farms live on mainnet only, like the real registry.
  useAvailableTokenRewardContractsForChains: () => (chainId: number) =>
    chainId === 1
      ? [
          {
            contractAddress: '0xFA12',
            chainId: 1,
            name: 'With: USDS Get: SPK',
            supplyToken: { symbol: 'USDS' },
            rewardToken: { symbol: 'SPK' }
          },
          {
            contractAddress: '0xC1E0',
            chainId: 1,
            name: 'Chronicle Points',
            supplyToken: { symbol: 'USDS' },
            rewardToken: { symbol: 'CLE' }
          }
        ]
      : []
}));

vi.mock('@/modules/savings/hooks/useSavingsModal', () => ({
  useSavingsModal: () => ({ openSupply: h.openSavingsSupply, openWithdraw: vi.fn() })
}));

vi.mock('@/modules/stusds/hooks/useStUsdsModal', () => ({
  useStUsdsModal: () => ({ openSupply: h.openStUsdsSupply, openWithdraw: vi.fn() })
}));

vi.mock('@/modules/morpho/hooks/useVaultModal', () => ({
  useVaultModal: () => ({ openSupply: h.openVaultSupply, openWithdraw: vi.fn() })
}));

vi.mock('@/modules/pendle/hooks/usePendleModal', () => ({
  usePendleModal: () => ({ openSupply: h.openPendleSupply, openWithdraw: vi.fn() })
}));

vi.mock('@/modules/rewards/hooks/useRewardsModal', () => ({
  useRewardsModal: () => ({ openSupply: h.openRewardsSupply, openWithdraw: vi.fn() })
}));

const KIND_INTENT: Record<SuppliedPosition['kind'], Intent> = {
  savings: Intent.SAVINGS_INTENT,
  rewards: Intent.REWARDS_INTENT,
  vault: Intent.VAULTS_INTENT,
  fixed: Intent.FIXED_INTENT,
  stusds: Intent.EXPERT_INTENT
};

const position = (
  kind: SuppliedPosition['kind'],
  over: Partial<SuppliedPosition> = {}
): SuppliedPosition => ({
  id: kind,
  rowId: over.id ?? kind,
  name: kind,
  tokenSymbol: 'USDS',
  kind,
  intent: KIND_INTENT[kind],
  amountUsd: 100,
  rate: 0.05,
  rateLoading: false,
  color: '#000',
  hoverColor: '#000',
  share: 1,
  detailPath: `/earn/${kind}`,
  chainId: 1,
  multichain: false,
  ...over
});

describe('usePortfolioSupplyActions', () => {
  beforeEach(() => {
    h.openSavingsSupply.mockClear();
    h.openStUsdsSupply.mockClear();
    h.openVaultSupply.mockClear();
    h.openPendleSupply.mockClear();
    h.openRewardsSupply.mockClear();
    h.switchChainAsync.mockReset();
    h.switchChainAsync.mockResolvedValue(undefined);
    h.setIsAutoSwitching.mockClear();
    h.setAutoSwitchIntent.mockClear();
    h.chainId = 1;
    h.chains = [{ id: 1 }, { id: 8453 }, { id: 10 }];
    h.geoDisabledModules.clear();
    h.isSafeWallet = false;
    h.pendleMarket.expiry = 4102444800;
  });
  afterEach(() => cleanup());

  it('resolves a savings position on the connected chain to an opener that launches the supply modal', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(position('savings'));

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openSavingsSupply).toHaveBeenCalledTimes(1);
  });

  it('switches to the position chain first, then opens, for a savings position off the connected chain', async () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });

    // Card scoped to Base while the wallet sits on mainnet: supply belongs to
    // the position's chain, so the handler moves the wallet there first.
    const handler = result.current(position('savings', { chainId: 8453 }));

    expect(handler).toBeTypeOf('function');
    await handler!();

    expect(h.switchChainAsync).toHaveBeenCalledWith({ chainId: 8453 });
    expect(h.openSavingsSupply).toHaveBeenCalledTimes(1);
    expect(h.switchChainAsync.mock.invocationCallOrder[0]).toBeLessThan(
      h.openSavingsSupply.mock.invocationCallOrder[0]
    );
  });

  it('targets the config Tenderly fork, never real Ethereum, when the build carries one (dev/staging)', async () => {
    h.chainId = 8453; // wallet on Base
    h.chains = [{ id: 1 }, { id: 314310 }, { id: 8453 }]; // dev config: Ethereum + fork + L2s
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });

    // Position read from real mainnet, but the auto-switch must land on the
    // fork — landing a dev wallet on Ethereum means real fees.
    await result.current(position('stusds', { chainId: 1 }))!();

    expect(h.switchChainAsync).toHaveBeenCalledWith({ chainId: 314310 });
    expect(h.openStUsdsSupply).toHaveBeenCalledTimes(1);
  });

  it('resolves a Morpho vault position to an opener that launches the vault modal with its config', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(
      position('vault', { id: 'vault-morpho-0xabc', address: '0xABC', rate: 0.0445 })
    );

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openVaultSupply).toHaveBeenCalledWith({
      vaultAddress: '0xABC',
      assetToken: { symbol: 'USDC' },
      vaultName: 'USDC Risk Capital',
      netRate: 0.0445
    });
  });

  it('resolves a Morpho vault from its own chain while the wallet is on an L2, switching first', async () => {
    h.chainId = 8453; // wallet on Base; the vault lives on mainnet
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(
      position('vault', { id: 'vault-morpho-0xabc', address: '0xABC', rate: 0.0445 })
    );

    expect(handler).toBeTypeOf('function');
    await handler!();

    expect(h.switchChainAsync).toHaveBeenCalledWith({ chainId: 1 });
    expect(h.openVaultSupply).toHaveBeenCalledWith({
      vaultAddress: '0xABC', // resolved on the position's chain, not the wallet's
      assetToken: { symbol: 'USDC' },
      vaultName: 'USDC Risk Capital',
      netRate: 0.0445
    });
  });

  it('returns undefined for a Spark (non-Morpho) vault position (no in-place modal)', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    expect(result.current(position('vault', { id: 'vault-sky-0xdef' }))).toBeUndefined();
  });

  it('resolves a rewards position to an opener that launches the rewards modal with its config', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(
      position('rewards', { id: 'rewards-spk', address: '0xFA12', rate: 0.045 })
    );

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openRewardsSupply).toHaveBeenCalledWith({
      contractAddress: '0xFA12',
      supplyToken: { symbol: 'USDS' },
      displayName: 'SPK Rewards',
      productName: 'With: USDS Get: SPK',
      rewardTokenSymbol: 'SPK',
      rate: 0.045
    });
  });

  it('omits the rewards-in token for a points farm (Chronicle) and titles it as Chronicle Points Rewards', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(
      position('rewards', { id: 'rewards-cle', address: '0xC1E0', rate: undefined })
    );

    handler!();
    expect(h.openRewardsSupply).toHaveBeenCalledWith({
      contractAddress: '0xC1E0',
      supplyToken: { symbol: 'USDS' },
      displayName: 'Chronicle Points Rewards',
      productName: 'Chronicle Points',
      rewardTokenSymbol: undefined,
      rate: undefined
    });
  });

  it('resolves a rewards position from its own chain registry while the wallet is on an L2', async () => {
    h.chainId = 8453; // wallet on Base; the farm lives on mainnet
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(
      position('rewards', { id: 'rewards-spk', address: '0xFA12', rate: 0.045 })
    );

    expect(handler).toBeTypeOf('function');
    await handler!();

    expect(h.switchChainAsync).toHaveBeenCalledWith({ chainId: 1 });
    expect(h.openRewardsSupply).toHaveBeenCalledWith({
      contractAddress: '0xFA12',
      supplyToken: { symbol: 'USDS' },
      displayName: 'SPK Rewards',
      productName: 'With: USDS Get: SPK',
      rewardTokenSymbol: 'SPK',
      rate: 0.045
    });
  });

  it('returns undefined for a rewards position with no known contract (caller navigates)', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });

    expect(result.current(position('rewards', { id: 'rewards-spk', address: '0xBEEF' }))).toBeUndefined();
    expect(result.current(position('rewards', { id: 'rewards-spk' }))).toBeUndefined();
    expect(h.openRewardsSupply).not.toHaveBeenCalled();
  });

  it('resolves a stUSDS position on the connected chain to an opener that launches the stUSDS modal', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(position('stusds'));

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openStUsdsSupply).toHaveBeenCalledTimes(1);
  });

  it('switches to mainnet first, then opens, for a stUSDS position while the wallet is on an L2', async () => {
    h.chainId = 8453; // wallet on Base; stUSDS position lives on mainnet
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(position('stusds'));

    expect(handler).toBeTypeOf('function');
    await handler!();

    expect(h.switchChainAsync).toHaveBeenCalledWith({ chainId: 1 });
    expect(h.openStUsdsSupply).toHaveBeenCalledTimes(1);
  });

  it('records the causing module for the network toast before switching', async () => {
    h.chainId = 8453;
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(position('fixed', { id: 'fixed-0x9c5', address: '0x9C5' }));

    await handler!();

    // Flags first, switch second — the toast fires on the chain change and
    // must find the reason already recorded. Left set on success: the toast
    // consumes and clears them.
    expect(h.setAutoSwitchIntent).toHaveBeenCalledExactlyOnceWith(Intent.FIXED_INTENT);
    expect(h.setIsAutoSwitching).toHaveBeenCalledExactlyOnceWith(true);
    expect(h.setAutoSwitchIntent.mock.invocationCallOrder[0]).toBeLessThan(
      h.switchChainAsync.mock.invocationCallOrder[0]
    );
  });

  it('returns undefined for a cross-chain position when the wallet is a Safe (caller navigates)', () => {
    // A Safe can't switch networks from the dapp: resolving to the switching
    // handler would leave a button that silently no-ops forever (APP-486).
    h.chainId = 8453;
    h.isSafeWallet = true;
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });

    expect(result.current(position('savings', { chainId: 1 }))).toBeUndefined();
    expect(h.switchChainAsync).not.toHaveBeenCalled();
    expect(h.openSavingsSupply).not.toHaveBeenCalled();
  });

  it('still resolves an in-place opener for a Safe when the position is on the connected chain', () => {
    h.isSafeWallet = true;
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(position('savings'));

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openSavingsSupply).toHaveBeenCalledTimes(1);
    expect(h.switchChainAsync).not.toHaveBeenCalled();
  });

  it('opens nothing and clears the auto flags when the wallet declines the switch', async () => {
    h.chainId = 8453;
    h.switchChainAsync.mockRejectedValue(new Error('user rejected'));
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(position('fixed', { id: 'fixed-0x9c5', address: '0x9C5' }));

    await handler!();

    expect(h.openPendleSupply).not.toHaveBeenCalled();
    expect(h.setIsAutoSwitching).toHaveBeenLastCalledWith(false);
    expect(h.setAutoSwitchIntent).toHaveBeenLastCalledWith(null);
  });

  it('engages no switch machinery when the position is on the connected chain', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    result.current(position('savings'))!();

    expect(h.openSavingsSupply).toHaveBeenCalledTimes(1);
    expect(h.switchChainAsync).not.toHaveBeenCalled();
    expect(h.setIsAutoSwitching).not.toHaveBeenCalled();
    expect(h.setAutoSwitchIntent).not.toHaveBeenCalled();
  });

  it('resolves a fixed (Pendle) position to an opener that launches the supply modal with its market', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(position('fixed', { id: 'fixed-0x9c5', address: '0x9C5' }));

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openPendleSupply).toHaveBeenCalledWith(h.pendleMarket);
  });

  it('switches to mainnet first, then opens the market modal, for a fixed position while on an L2', async () => {
    h.chainId = 8453; // wallet on Base; the PT position lives on mainnet
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    const handler = result.current(position('fixed', { id: 'fixed-0x9c5', address: '0x9C5' }));

    expect(handler).toBeTypeOf('function');
    await handler!();

    expect(h.switchChainAsync).toHaveBeenCalledWith({ chainId: 1 });
    expect(h.openPendleSupply).toHaveBeenCalledWith(h.pendleMarket);
    expect(h.switchChainAsync.mock.invocationCallOrder[0]).toBeLessThan(
      h.openPendleSupply.mock.invocationCallOrder[0]
    );
  });

  it('returns undefined for a matured fixed market (redemption lives on the overview)', () => {
    h.pendleMarket.expiry = 1; // long past
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    expect(result.current(position('fixed', { id: 'fixed-0x9c5', address: '0x9C5' }))).toBeUndefined();
    expect(h.openPendleSupply).not.toHaveBeenCalled();
  });

  it('returns undefined for a fixed position whose address is not in the market registry', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    expect(result.current(position('fixed', { id: 'fixed-0x404', address: '0x404' }))).toBeUndefined();
    expect(h.openPendleSupply).not.toHaveBeenCalled();
  });

  it('returns undefined for a savings position when the savings module is geo-restricted (caller navigates to the guarded route)', () => {
    h.geoDisabledModules.add('savings');
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });

    expect(result.current(position('savings'))).toBeUndefined();
    expect(h.openSavingsSupply).not.toHaveBeenCalled();
  });

  it('gates every in-place modal family by its own geo module', () => {
    // kind → its geo ModuleId (stusds rides the expert module).
    const families = [
      ['rewards', 'rewards', { id: 'rewards-spk', address: '0xFA12' }],
      ['vault', 'vaults', { id: 'vault-morpho-0xabc', address: '0xABC' }],
      ['stusds', 'expert', {}],
      ['fixed', 'fixed', { id: 'fixed-0x9c5', address: '0x9C5' }]
    ] as const;

    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });
    for (const [kind, moduleId, over] of families) {
      expect(result.current(position(kind, over))).toBeTypeOf('function');
      h.geoDisabledModules.add(moduleId);
      expect(result.current(position(kind, over))).toBeUndefined();
    }
  });

  it('leaves other modules resolvable while one is geo-restricted', () => {
    h.geoDisabledModules.add('savings');
    const { result } = renderHook(() => usePortfolioSupplyActions(), { wrapper: AnalyticsFlowProvider });

    result.current(position('stusds'))!();
    expect(h.openStUsdsSupply).toHaveBeenCalledTimes(1);
  });
});
