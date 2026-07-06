import { describe, it, expect } from 'vitest';
import { mainnet } from 'wagmi/chains';
import { buildVaultDeepLinkMap, computeVaultBalances } from './VaultsBalanceCard';
import { sparkUsdtVaultAddress } from '@/hooks/generated';
import type { MorphoVaultBalance } from '@/hooks';
import type { Token } from '@/hooks/tokens/types';

const SPARK_USDT_VAULT_ADDRESS = sparkUsdtVaultAddress[mainnet.id];
const MORPHO_ADDRESS = '0x1234567890123456789012345678901234567890' as const;
const BASE_URL = '/?network=ethereum&widget=vaults';

const CHAIN_ID = 1;
const ONE = 10n ** 18n; // one unit, normalized to 18 decimals

const makeToken = (symbol: string): Token => ({
  address: { [CHAIN_ID]: '0x0000000000000000000000000000000000000000' },
  name: symbol,
  color: '#000',
  symbol,
  decimals: 6
});

const makeBalance = (address: `0x${string}`, name: string, balanceNormalized: bigint): MorphoVaultBalance => {
  const assetToken = makeToken(name);
  return {
    vault: { provider: 'morpho', name, vaultAddress: { [CHAIN_ID]: address }, assetToken },
    vaultAddress: address,
    balance: balanceNormalized,
    balanceNormalized,
    assetToken
  };
};

describe('buildVaultDeepLinkMap', () => {
  it('derives vault_module=sky for a Spark vault from its provider', () => {
    const map = buildVaultDeepLinkMap(BASE_URL, [
      { vaultAddress: SPARK_USDT_VAULT_ADDRESS, vault: { provider: 'sky' } }
    ]);
    expect(map[SPARK_USDT_VAULT_ADDRESS]).toBe(
      `${BASE_URL}&vault=${SPARK_USDT_VAULT_ADDRESS}&vault_module=sky`
    );
  });

  it('derives vault_module=morpho for a Morpho vault (unchanged behaviour)', () => {
    const map = buildVaultDeepLinkMap(BASE_URL, [
      { vaultAddress: MORPHO_ADDRESS, vault: { provider: 'morpho' } }
    ]);
    expect(map[MORPHO_ADDRESS]).toBe(`${BASE_URL}&vault=${MORPHO_ADDRESS}&vault_module=morpho`);
  });

  it('routes each vault to its own provider when both are present', () => {
    const map = buildVaultDeepLinkMap(BASE_URL, [
      { vaultAddress: MORPHO_ADDRESS, vault: { provider: 'morpho' } },
      { vaultAddress: SPARK_USDT_VAULT_ADDRESS, vault: { provider: 'sky' } }
    ]);
    expect(map[MORPHO_ADDRESS]).toContain('vault_module=morpho');
    expect(map[SPARK_USDT_VAULT_ADDRESS]).toContain('vault_module=sky');
  });

  it('uses ? as the separator when the base url has no query string', () => {
    const map = buildVaultDeepLinkMap('/vaults', [
      { vaultAddress: SPARK_USDT_VAULT_ADDRESS, vault: { provider: 'sky' } }
    ]);
    expect(map[SPARK_USDT_VAULT_ADDRESS]).toBe(
      `/vaults?vault=${SPARK_USDT_VAULT_ADDRESS}&vault_module=sky`
    );
  });

  it('maps every vault to an empty string when no base url is provided', () => {
    const map = buildVaultDeepLinkMap(undefined, [
      { vaultAddress: SPARK_USDT_VAULT_ADDRESS, vault: { provider: 'sky' } }
    ]);
    expect(map[SPARK_USDT_VAULT_ADDRESS]).toBe('');
  });
});

describe('computeVaultBalances (provider-neutral rates)', () => {
  it('reflects a non-zero Spark rate on its row and in the weighted average', () => {
    const ratesByAddress = new Map([[SPARK_USDT_VAULT_ADDRESS.toLowerCase(), 0.05]]);

    const { vaultBalances, weightedAverageRate } = computeVaultBalances({
      vaults: [makeBalance(SPARK_USDT_VAULT_ADDRESS, 'Tether Savings', ONE)],
      ratesByAddress,
      vaultChainId: CHAIN_ID,
      hideZeroBalances: false
    });

    expect(vaultBalances[0].rate).toBe(0.05);
    expect(weightedAverageRate).toBeCloseTo(0.05, 10);
  });

  it('blends Morpho and Spark rates into the weighted average by balance', () => {
    const ratesByAddress = new Map([
      [MORPHO_ADDRESS.toLowerCase(), 0.04],
      [SPARK_USDT_VAULT_ADDRESS.toLowerCase(), 0.02]
    ]);

    const { vaultBalances, weightedAverageRate } = computeVaultBalances({
      // Equal normalized balances ⇒ simple mean of the two rates
      vaults: [
        makeBalance(MORPHO_ADDRESS, 'Morpho Vault', ONE),
        makeBalance(SPARK_USDT_VAULT_ADDRESS, 'Tether Savings', ONE)
      ],
      ratesByAddress,
      vaultChainId: CHAIN_ID,
      hideZeroBalances: false
    });

    const byAddress = new Map(vaultBalances.map(v => [v.vaultAddress, v.rate]));
    expect(byAddress.get(MORPHO_ADDRESS)).toBe(0.04);
    expect(byAddress.get(SPARK_USDT_VAULT_ADDRESS)).toBe(0.02);
    expect(weightedAverageRate).toBeCloseTo(0.03, 10);
  });

  it('renders a genuinely-zero Spark rate as 0% (present in the map, value 0)', () => {
    const ratesByAddress = new Map([[SPARK_USDT_VAULT_ADDRESS.toLowerCase(), 0]]);

    const { vaultBalances, weightedAverageRate } = computeVaultBalances({
      vaults: [makeBalance(SPARK_USDT_VAULT_ADDRESS, 'Tether Savings', ONE)],
      ratesByAddress,
      vaultChainId: CHAIN_ID,
      hideZeroBalances: false
    });

    expect(vaultBalances[0].rate).toBe(0);
    expect(weightedAverageRate).toBe(0);
  });

  it('leaves Morpho rows unchanged when no Spark position is held', () => {
    const ratesByAddress = new Map([[MORPHO_ADDRESS.toLowerCase(), 0.04]]);

    const { vaultBalances, weightedAverageRate } = computeVaultBalances({
      vaults: [makeBalance(MORPHO_ADDRESS, 'Morpho Vault', ONE)],
      ratesByAddress,
      vaultChainId: CHAIN_ID,
      hideZeroBalances: false
    });

    expect(vaultBalances[0].rate).toBe(0.04);
    expect(weightedAverageRate).toBeCloseTo(0.04, 10);
  });
});
