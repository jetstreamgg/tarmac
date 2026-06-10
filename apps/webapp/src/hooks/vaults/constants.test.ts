import { describe, expect, it } from 'vitest';
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
