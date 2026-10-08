import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskLevel } from '@/hooks';
import { useStakeRowVaultLookup } from './useStakeRowVault';

const RAY = 10n ** 27n;
const WAD = 10n ** 18n;

const h = vi.hoisted(() => ({
  drip: { data: undefined as bigint | undefined, isLoading: false }
}));

// Capped price $0.025 (spot × mat), stored rate 1.
const ILK = {
  spot: 20_833_333_333_333_333_333_333_333n,
  rate: RAY,
  dust: 30_000n * 10n ** 45n,
  par: RAY,
  mat: (12n * RAY) / 10n
};

// The minimum position: 1,440,000.01 SKY against the 30,000 USDS dust.
vi.mock('./useStakeUrnVaults', () => ({
  useStakeUrnVaults: () => ({
    data: [
      {
        index: 0,
        urnAddress: '0x0000000000000000000000000000000000000001',
        skyLocked: 1_440_000n * WAD + WAD / 100n,
        art: 30_000n * WAD,
        usdsDebt: 30_000n * WAD
      }
    ],
    ilk: ILK,
    isLoading: false,
    error: null
  })
}));

vi.mock('@/hooks/vaults/useSimulatedDripRate', () => ({
  useSimulatedDripRate: () => h.drip
}));

vi.mock('@/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks')>()),
  usePrices: () => ({ data: { SKY: { price: '0.07' } } })
}));

describe('useStakeRowVaultLookup', () => {
  beforeEach(() => {
    h.drip = { data: undefined, isLoading: false };
  });

  it('rates an urn whose accrued debt crossed the capped price as Liquidation, like the details modal', () => {
    h.drip = { data: (RAY * 1001n) / 1000n, isLoading: false };
    expect(useStakeRowVaultLookup().vaultOf(0)?.riskLevel).toBe(RiskLevel.LIQUIDATION);
  });

  it('holds the row until the drip simulation lands instead of painting the stored-rate risk', () => {
    h.drip = { data: undefined, isLoading: true };
    const lookup = useStakeRowVaultLookup();
    expect(lookup.isLoading).toBe(true);
    expect(lookup.vaultOf(0)).toBeUndefined();
  });

  it('falls back to the stored rate when the drip simulation fails', () => {
    expect(useStakeRowVaultLookup().vaultOf(0)?.riskLevel).toBe(RiskLevel.MEDIUM);
  });

  it('never uses a cached drip rate below the stored one', () => {
    h.drip = { data: RAY - 1n, isLoading: false };
    expect(useStakeRowVaultLookup().vaultOf(0)?.riskLevel).toBe(RiskLevel.MEDIUM);
  });
});
