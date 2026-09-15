import { describe, it, expect } from 'vitest';
import { buildVaultRatesByAddress, type VaultRateSource } from './vaultRates';

const MORPHO_ADDR = '0xAAaaAAAAaAAAaAAAAaaAAaAAAAaAaaAAAAaA0001' as const;

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
});
