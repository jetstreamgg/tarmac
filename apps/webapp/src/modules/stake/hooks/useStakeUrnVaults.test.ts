import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accruedRate, useStakeUrnVaults } from './useStakeUrnVaults';

const RAY = 10n ** 27n;
const WAD = 10n ** 18n;

const h = vi.hoisted(() => ({
  drip: { data: undefined as bigint | undefined, isLoading: false }
}));

vi.mock('react', async importOriginal => ({
  ...(await importOriginal<typeof import('react')>()),
  useMemo: (fn: () => unknown) => fn()
}));

vi.mock('wagmi', () => ({
  useConfig: () => ({}),
  useChainId: () => 1,
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000002' })
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      urns: [
        {
          index: 0,
          urnAddress: '0x0000000000000000000000000000000000000001',
          skyLocked: 1_440_000n * WAD,
          art: 30_000n * WAD,
          usdsDebt: 30_000n * WAD
        }
      ],
      ilk: { spot: 1n, rate: RAY, dust: 0n, par: RAY, mat: RAY }
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn()
  })
}));

vi.mock('@/hooks/vaults/useSimulatedDripRate', () => ({
  useSimulatedDripRate: () => h.drip
}));

describe('useStakeUrnVaults', () => {
  beforeEach(() => {
    h.drip = { data: undefined, isLoading: false };
  });

  it('shows the debt with the interest accrued since the last drip, like the details modal', () => {
    h.drip = { data: (RAY * 1001n) / 1000n, isLoading: false };
    expect(useStakeUrnVaults().data?.[0].usdsDebt).toBe(30_030n * WAD);
  });

  it('holds the rows until the drip simulation lands instead of painting the stored-rate debt', () => {
    h.drip = { data: undefined, isLoading: true };
    const result = useStakeUrnVaults();
    expect(result.isLoading).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('falls back to the stored rate when the drip simulation fails', () => {
    expect(useStakeUrnVaults().data?.[0].usdsDebt).toBe(30_000n * WAD);
  });
});

describe('accruedRate', () => {
  it('never goes below the stored rate', () => {
    expect(accruedRate(RAY, RAY - 1n)).toBe(RAY);
    expect(accruedRate(RAY, RAY + 1n)).toBe(RAY + 1n);
    expect(accruedRate(RAY, undefined)).toBe(RAY);
  });
});
