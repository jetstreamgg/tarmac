import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortfolioSupplyActions } from './usePortfolioSupplyActions';
import type { SuppliedPosition } from '../helpers/suppliedView';

const h = vi.hoisted(() => ({
  openSavingsSupply: vi.fn(),
  openVaultSupply: vi.fn(),
  chainId: 1
}));

vi.mock('wagmi', () => ({ useChainId: () => h.chainId }));

vi.mock('@/hooks', () => ({
  VAULTS: [
    {
      provider: 'morpho',
      name: 'USDC Risk Capital',
      vaultAddress: { 1: '0xABC' },
      assetToken: { symbol: 'USDC' }
    },
    { provider: 'sky', name: 'Tether Savings', vaultAddress: { 1: '0xDEF' }, assetToken: { symbol: 'USDT' } }
  ]
}));

vi.mock('@/modules/savings/hooks/useSavingsModal', () => ({
  useSavingsModal: () => ({ openSupply: h.openSavingsSupply, openWithdraw: vi.fn() })
}));

vi.mock('@/modules/morpho/hooks/useVaultModal', () => ({
  useVaultModal: () => ({ openSupply: h.openVaultSupply, openWithdraw: vi.fn() })
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
    h.openVaultSupply.mockClear();
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

  it('returns undefined for products with no in-place supply modal (caller navigates)', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());

    for (const kind of ['rewards', 'fixed', 'stusds'] as const) {
      expect(result.current(position(kind))).toBeUndefined();
    }
  });
});
