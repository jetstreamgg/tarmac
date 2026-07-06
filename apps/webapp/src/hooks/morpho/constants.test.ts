import { describe, expect, it } from 'vitest';
import { MORPHO_VAULTS, getMorphoVaultByAddress } from './constants';

describe('MORPHO_VAULTS provider registry', () => {
  it("tags every Morpho vault entry with provider 'morpho'", () => {
    expect(MORPHO_VAULTS.length).toBeGreaterThan(0);
    for (const vault of MORPHO_VAULTS) {
      expect(vault.provider).toBe('morpho');
    }
  });

  it('resolves a registered vault by address on its configured chain', () => {
    const [first] = MORPHO_VAULTS;
    const [chainId, address] = Object.entries(first.vaultAddress)[0];

    const found = getMorphoVaultByAddress(address, Number(chainId));

    expect(found).toBeDefined();
    expect(found?.provider).toBe('morpho');
    expect(found?.name).toBe(first.name);
  });
});
