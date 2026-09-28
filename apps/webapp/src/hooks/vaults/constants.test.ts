import { describe, expect, it } from 'vitest';
import { mainnet } from 'wagmi/chains';
import { VAULTS, getVaultByAddress } from './constants';
import { MORPHO_VAULTS } from '../morpho/constants';

describe('unified VAULTS registry', () => {
  it('includes every Morpho vault', () => {
    expect(VAULTS).toEqual(MORPHO_VAULTS);
  });

  it('resolves a Morpho vault through the unified lookup (case-insensitive)', () => {
    const [morpho] = MORPHO_VAULTS;
    const [chainId, address] = Object.entries(morpho.vaultAddress)[0];
    const found = getVaultByAddress(address.toLowerCase() as `0x${string}`, Number(chainId));
    expect(found?.provider).toBe('morpho');
    expect(found?.name).toBe(morpho.name);
  });

  it('returns undefined for an unregistered address', () => {
    expect(getVaultByAddress('0x000000000000000000000000000000000000dEaD', mainnet.id)).toBeUndefined();
  });
});
