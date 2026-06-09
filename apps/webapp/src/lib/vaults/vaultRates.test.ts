import { describe, it, expect } from 'vitest';
import { buildVaultRatesByAddress, type VaultRateSource } from './vaultRates';
import { calculateApyFromStr } from '@/utils/math/calculateApy';

const MORPHO_ADDR = '0xAAaaAAAAaAAAaAAAAaaAAaAAAAaAaaAAAAaA0001' as const;
const SPARK_ADDR = '0xBBbbBBBBbBBBbBBBBbbBBbBBBBbBbbBBBBbB0002' as const;

// A RAY accumulator above 1e27 ⇒ a live, non-zero APY. 1e27 exactly ⇒ dormant 0%.
const RAY = 10n ** 27n;
const ACTIVE_VSR = RAY + 100_000_000_000n; // small per-second rate ⇒ small positive APY

describe('buildVaultRatesByAddress (provider-routing core)', () => {
  it('keys a Morpho rate by lowercased address using its decimal netRate', () => {
    const sources: VaultRateSource[] = [{ provider: 'morpho', address: MORPHO_ADDR, netRate: 0.052 }];

    const map = buildVaultRatesByAddress(sources);

    expect(map.get(MORPHO_ADDR.toLowerCase())).toBe(0.052);
  });

  it('omits a Morpho vault whose rate has not been fetched (undefined)', () => {
    const sources: VaultRateSource[] = [{ provider: 'morpho', address: MORPHO_ADDR, netRate: undefined }];

    const map = buildVaultRatesByAddress(sources);

    expect(map.has(MORPHO_ADDR.toLowerCase())).toBe(false);
  });

  it('derives a Spark rate from on-chain vsr as a decimal (percentage ÷ 100)', () => {
    const sources: VaultRateSource[] = [{ provider: 'sky', address: SPARK_ADDR, vsr: ACTIVE_VSR }];

    const map = buildVaultRatesByAddress(sources);

    const expected = calculateApyFromStr(ACTIVE_VSR) / 100;
    expect(expected).toBeGreaterThan(0);
    expect(map.get(SPARK_ADDR.toLowerCase())).toBe(expected);
  });

  it('renders a dormant Spark vault (vsr === 1e27) as a present 0, not a missing entry', () => {
    const sources: VaultRateSource[] = [{ provider: 'sky', address: SPARK_ADDR, vsr: RAY }];

    const map = buildVaultRatesByAddress(sources);

    expect(map.has(SPARK_ADDR.toLowerCase())).toBe(true);
    expect(map.get(SPARK_ADDR.toLowerCase())).toBe(0);
  });

  it('omits a Spark vault whose vsr has not been read yet (undefined)', () => {
    const sources: VaultRateSource[] = [{ provider: 'sky', address: SPARK_ADDR, vsr: undefined }];

    const map = buildVaultRatesByAddress(sources);

    expect(map.has(SPARK_ADDR.toLowerCase())).toBe(false);
  });

  it('merges Morpho and Spark sources into one address→rate map', () => {
    const sources: VaultRateSource[] = [
      { provider: 'morpho', address: MORPHO_ADDR, netRate: 0.04 },
      { provider: 'sky', address: SPARK_ADDR, vsr: ACTIVE_VSR }
    ];

    const map = buildVaultRatesByAddress(sources);

    expect(map.size).toBe(2);
    expect(map.get(MORPHO_ADDR.toLowerCase())).toBe(0.04);
    expect(map.get(SPARK_ADDR.toLowerCase())).toBeGreaterThan(0);
  });
});
