/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { chainId, forkChainId } from '@/utils/chainId';
import type { PendleMarketConfig } from './pendle';

const h = vi.hoisted(() => ({ chainId: 1 }));

vi.mock('wagmi', () => ({
  useChainId: vi.fn(() => h.chainId),
  useReadContract: vi.fn(() => ({ data: undefined, isLoading: false }))
}));

vi.mock('./usePendleMarketHistory', () => ({
  usePendleMarketHistory: vi.fn(() => ({ data: undefined, isLoading: false }))
}));

import { useReadContract } from 'wagmi';
import { usePendleRedeemPreview } from './usePendleRedeemPreview';
import { usePendleMaturedPositionEarnings } from './usePendleMaturedPositionEarnings';

const MARKET: PendleMarketConfig = {
  name: 'PT-sUSDS',
  slug: 'pt-susds',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548',
  ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1',
  syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927',
  underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
  underlyingSymbol: 'sUSDS',
  underlyingDecimals: 18,
  expiry: 2_000_000_000,
  usdsEquivalence: 'sUSDS'
};

const readChainIds = () =>
  vi.mocked(useReadContract).mock.calls.map(([args]) => (args as { chainId?: number }).chainId);

describe('Pendle reads on the Tenderly fork', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK_WALLET', 'false'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    h.chainId = 1;
  });

  it.each(Object.entries(forkChainId))('read the Ethereum fork from fork %s, never real mainnet', (_, id) => {
    h.chainId = id;
    renderHook(() => usePendleMaturedPositionEarnings(MARKET, 10n ** 18n));

    const ids = readChainIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(read => read === chainId.tenderly)).toBe(true);
  });

  it('read the Ethereum fork on it and mainnet on mainnet, as before the fork L2s', () => {
    h.chainId = chainId.tenderly;
    renderHook(() => usePendleRedeemPreview(MARKET, 10n ** 18n));
    expect(readChainIds().every(read => read === chainId.tenderly)).toBe(true);

    vi.mocked(useReadContract).mockClear();
    h.chainId = chainId.mainnet;
    renderHook(() => usePendleRedeemPreview(MARKET, 10n ** 18n));
    expect(readChainIds().every(read => read === chainId.mainnet)).toBe(true);
  });
});
