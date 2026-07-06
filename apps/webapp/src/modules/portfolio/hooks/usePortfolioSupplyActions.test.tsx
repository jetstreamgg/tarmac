import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortfolioSupplyActions } from './usePortfolioSupplyActions';
import type { SuppliedPosition } from '../helpers/suppliedView';

const h = vi.hoisted(() => ({
  openSavingsSupply: vi.fn(),
  openStUsdsSupply: vi.fn(),
  openVaultSupply: vi.fn(),
  openRewardsSupply: vi.fn(),
  chainId: 1
}));

vi.mock('wagmi', () => ({ useChainId: () => h.chainId }));

vi.mock('@/hooks', () => ({
  TOKENS: { cle: { symbol: 'CLE' } },
  VAULTS: [
    {
      provider: 'morpho',
      name: 'USDC Risk Capital',
      vaultAddress: { 1: '0xABC' },
      assetToken: { symbol: 'USDC' }
    },
    { provider: 'sky', name: 'Tether Savings', vaultAddress: { 1: '0xDEF' }, assetToken: { symbol: 'USDT' } }
  ],
  useAvailableTokenRewardContracts: () => [
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

vi.mock('@/modules/rewards/hooks/useRewardsModal', () => ({
  useRewardsModal: () => ({ openSupply: h.openRewardsSupply, openWithdraw: vi.fn() })
}));

const position = (
  kind: SuppliedPosition['kind'],
  over: Partial<SuppliedPosition> = {}
): SuppliedPosition => ({
  id: kind,
  name: kind,
  tokenSymbol: 'USDS',
  kind,
  amountUsd: 100,
  rate: 0.05,
  color: '#000',
  share: 1,
  detailPath: `/earn/${kind}`,
  chainIds: [1],
  ...over
});

describe('usePortfolioSupplyActions', () => {
  beforeEach(() => {
    h.openSavingsSupply.mockClear();
    h.openStUsdsSupply.mockClear();
    h.openVaultSupply.mockClear();
    h.openRewardsSupply.mockClear();
    h.chainId = 1;
  });
  afterEach(() => cleanup());

  it('resolves a savings position on the connected chain to an opener that launches the supply modal', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
    const handler = result.current(position('savings'));

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openSavingsSupply).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for a savings position not on the connected chain (caller navigates)', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());

    // Card scoped to Base — the in-place modal would supply on mainnet, so don't open it.
    expect(result.current(position('savings', { chainIds: [8453] }))).toBeUndefined();
    expect(h.openSavingsSupply).not.toHaveBeenCalled();
  });

  it('resolves a Morpho vault position to an opener that launches the vault modal with its config', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
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

  it('returns undefined for a vault position off the connected chain', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
    expect(
      result.current(position('vault', { id: 'vault-morpho-0xabc', address: '0xABC', chainIds: [8453] }))
    ).toBeUndefined();
    expect(h.openVaultSupply).not.toHaveBeenCalled();
  });

  it('returns undefined for a Spark (non-Morpho) vault position (no in-place modal)', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
    expect(result.current(position('vault', { id: 'vault-sky-0xdef' }))).toBeUndefined();
  });

  it('resolves a rewards position to an opener that launches the rewards modal with its config', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
    const handler = result.current(
      position('rewards', { id: 'rewards-spk', address: '0xFA12', rate: 0.045 })
    );

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openRewardsSupply).toHaveBeenCalledWith({
      contractAddress: '0xFA12',
      supplyToken: { symbol: 'USDS' },
      displayName: 'SPK Rewards',
      rewardTokenSymbol: 'SPK',
      rate: 0.045
    });
  });

  it('omits the rewards-in token for a points farm (Chronicle) and titles it by its registry name', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
    const handler = result.current(
      position('rewards', { id: 'rewards-cle', address: '0xC1E0', rate: undefined })
    );

    handler!();
    expect(h.openRewardsSupply).toHaveBeenCalledWith({
      contractAddress: '0xC1E0',
      supplyToken: { symbol: 'USDS' },
      displayName: 'Chronicle Points',
      rewardTokenSymbol: undefined,
      rate: undefined
    });
  });

  it('returns undefined for a rewards position off the connected chain or with no known contract', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());

    expect(
      result.current(position('rewards', { id: 'rewards-spk', address: '0xFA12', chainIds: [8453] }))
    ).toBeUndefined();
    expect(result.current(position('rewards', { id: 'rewards-spk', address: '0xBEEF' }))).toBeUndefined();
    expect(result.current(position('rewards', { id: 'rewards-spk' }))).toBeUndefined();
    expect(h.openRewardsSupply).not.toHaveBeenCalled();
  });

  it('resolves a stUSDS position on the connected chain to an opener that launches the stUSDS modal', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
    const handler = result.current(position('stusds'));

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openStUsdsSupply).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for a stUSDS position not on the connected chain (caller navigates)', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
    expect(result.current(position('stusds', { chainIds: [8453] }))).toBeUndefined();
    expect(h.openStUsdsSupply).not.toHaveBeenCalled();
  });

  it('returns undefined for products with no in-place supply modal (caller navigates)', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());

    for (const kind of ['fixed'] as const) {
      expect(result.current(position(kind))).toBeUndefined();
    }
  });
});
