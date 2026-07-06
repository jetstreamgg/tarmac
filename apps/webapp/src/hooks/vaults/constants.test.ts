import { afterEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../constants';
import { VAULTS, getVaultByAddress } from './constants';
import { sparkUsdtVaultAddress } from '../generated';
import { MORPHO_VAULTS } from '../morpho/constants';

const SPARK_USDT_VAULT_ADDRESS = sparkUsdtVaultAddress[mainnet.id];

describe('unified VAULTS registry', () => {
  it('includes every Morpho vault and the Spark Tether Savings vault', () => {
    expect(VAULTS.length).toBe(MORPHO_VAULTS.length + 1);

    const spark = VAULTS.filter(v => v.provider === 'sky');
    expect(spark).toHaveLength(1);
    expect(spark[0]).toMatchObject({
      provider: 'sky',
      name: 'Tether Savings',
      symbol: 'sUSDT'
    });
  });

  it('registers the Spark vault with USDT as the underlying asset', () => {
    const spark = VAULTS.find(v => v.provider === 'sky');
    expect(spark?.assetToken.symbol).toBe('USDT');
  });

  it('maps the Spark vault address on both mainnet and the Tenderly fork', () => {
    const spark = VAULTS.find(v => v.provider === 'sky');
    expect(spark?.vaultAddress[mainnet.id]).toBe(SPARK_USDT_VAULT_ADDRESS);
    expect(spark?.vaultAddress[TENDERLY_CHAIN_ID]).toBe(SPARK_USDT_VAULT_ADDRESS);
  });

  it('resolves the Spark vault via the provider-neutral address lookup (case-insensitive)', () => {
    const found = getVaultByAddress(SPARK_USDT_VAULT_ADDRESS.toLowerCase() as `0x${string}`, mainnet.id);
    expect(found?.provider).toBe('sky');
    expect(found?.name).toBe('Tether Savings');
  });

  it('still resolves a Morpho vault through the unified lookup', () => {
    const [morpho] = MORPHO_VAULTS;
    const [chainId, address] = Object.entries(morpho.vaultAddress)[0];
    const found = getVaultByAddress(address, Number(chainId));
    expect(found?.provider).toBe('morpho');
  });

  it('returns undefined for an unregistered address', () => {
    expect(getVaultByAddress('0x000000000000000000000000000000000000dEaD', mainnet.id)).toBeUndefined();
  });
});

// The flag is read once at module load (`SUSDT_VAULT_ENABLED` in lib/constants),
// so each case stubs the env and re-imports the registry to re-evaluate it.
describe('VAULTS registry — sUSDT feature flag (APP-323)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('excludes the sUSDT vault and stops resolving its address when the flag is off', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUSDT_VAULT_ENABLED', 'false');
    const { VAULTS: gatedVaults, getVaultByAddress: gatedLookup } = await import('./constants');

    expect(gatedVaults).toHaveLength(MORPHO_VAULTS.length);
    expect(gatedVaults.some(v => v.provider === 'sky')).toBe(false);
    expect(gatedLookup(SPARK_USDT_VAULT_ADDRESS, mainnet.id)).toBeUndefined();
    // Morpho vaults are unaffected by the flag.
    const [morpho] = MORPHO_VAULTS;
    const [chainId, address] = Object.entries(morpho.vaultAddress)[0];
    expect(gatedLookup(address as `0x${string}`, Number(chainId))?.provider).toBe('morpho');
  });

  it('includes the sUSDT vault when the flag is on', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUSDT_VAULT_ENABLED', 'true');
    const { VAULTS: gatedVaults, getVaultByAddress: gatedLookup } = await import('./constants');

    expect(gatedVaults).toHaveLength(MORPHO_VAULTS.length + 1);
    expect(gatedLookup(SPARK_USDT_VAULT_ADDRESS, mainnet.id)?.provider).toBe('sky');
  });
});
