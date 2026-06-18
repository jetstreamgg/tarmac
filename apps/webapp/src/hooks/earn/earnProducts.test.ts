import { describe, expect, it } from 'vitest';
import { mainnet, base, arbitrum, optimism, unichain } from 'wagmi/chains';
import { Intent } from '@/lib/enums';
import { ROUTES } from '@/lib/routes';
import { TOKENS } from '../tokens/tokens.constants';
import { VAULTS } from '../vaults/constants';
import { PENDLE_MARKETS } from '../pendle/constants';
import type { RewardContract } from '../rewards/rewards';
import { buildEarnProducts, productNetworks } from './earnProducts';

const TENDERLY_CHAIN_ID = 314310;
const PRODUCTION_FAMILY = [mainnet.id, base.id, arbitrum.id, optimism.id, unichain.id];

const REWARD_FIXTURES = [
  {
    supplyToken: TOKENS.usds,
    rewardToken: TOKENS.spk,
    contractAddress: '0x0000000000000000000000000000000000000001' as `0x${string}`,
    chainId: mainnet.id,
    name: 'With: USDS Get: SPK'
  },
  {
    supplyToken: TOKENS.usds,
    rewardToken: TOKENS.cle,
    contractAddress: '0x0000000000000000000000000000000000000002' as `0x${string}`,
    chainId: mainnet.id,
    name: 'Chronicle Points'
  }
] as RewardContract[];

describe('productNetworks', () => {
  it('keeps savings multichain — every production chain with an sUSDS deployment', () => {
    expect(productNetworks(Intent.SAVINGS_INTENT, PRODUCTION_FAMILY, TOKENS.susds.address)).toEqual(
      PRODUCTION_FAMILY
    );
  });

  it('restricts mainnet-only modules to mainnet within the production family', () => {
    expect(productNetworks(Intent.REWARDS_INTENT, PRODUCTION_FAMILY)).toEqual([mainnet.id]);
    expect(productNetworks(Intent.VAULTS_INTENT, PRODUCTION_FAMILY)).toEqual([mainnet.id]);
    expect(productNetworks(Intent.FIXED_INTENT, PRODUCTION_FAMILY)).toEqual([mainnet.id]);
    expect(productNetworks(Intent.EXPERT_INTENT, PRODUCTION_FAMILY)).toEqual([mainnet.id]);
  });

  it('maps the whole tenderly family onto the fork', () => {
    expect(productNetworks(Intent.SAVINGS_INTENT, [TENDERLY_CHAIN_ID], TOKENS.susds.address)).toEqual([
      TENDERLY_CHAIN_ID
    ]);
    expect(productNetworks(Intent.VAULTS_INTENT, [TENDERLY_CHAIN_ID])).toEqual([TENDERLY_CHAIN_ID]);
  });

  it('drops chains where the address map has no deployment', () => {
    expect(productNetworks(Intent.SAVINGS_INTENT, PRODUCTION_FAMILY, { [mainnet.id]: '0x1' })).toEqual([
      mainnet.id
    ]);
  });
});

describe('buildEarnProducts', () => {
  const products = buildEarnProducts(PRODUCTION_FAMILY, mainnet.id, REWARD_FIXTURES);

  it('emits one row per product instance: savings + rewards + vaults + markets + stUSDS', () => {
    expect(products).toHaveLength(1 + REWARD_FIXTURES.length + VAULTS.length + PENDLE_MARKETS.length + 1);
  });

  it('assigns stable unique ids', () => {
    const ids = products.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('savings');
    expect(ids).toContain('rewards-spk');
    expect(ids).toContain('stusds');
  });

  // TODO(BL-07): update when risk ratings get a real source.
  it('hardcodes risk tiers: advanced for stUSDS, moderate elsewhere', () => {
    for (const product of products) {
      expect(product.risk).toBe(product.kind === 'stusds' ? 'advanced' : 'moderate');
    }
  });

  it('builds detail paths from the route contract', () => {
    const byId = Object.fromEntries(products.map(p => [p.id, p]));
    expect(byId['savings'].detailPath).toBe(ROUTES.EARN_SAVINGS);
    expect(byId['rewards-spk'].detailPath).toBe(
      `${ROUTES.EARN_REWARDS}/${REWARD_FIXTURES[0].contractAddress}`
    );
    expect(byId['stusds'].detailPath).toBe(`${ROUTES.EARN_EXPERT}/stusds`);
    for (const product of products.filter(p => p.kind === 'vault')) {
      expect(product.detailPath.startsWith(`${ROUTES.EARN_VAULTS}/`)).toBe(true);
    }
    for (const product of products.filter(p => p.kind === 'fixed')) {
      expect(product.detailPath).toBe(`${ROUTES.EARN_FIXED}/market/${product.address}`);
      expect(product.maturity).toBeGreaterThan(0);
    }
  });

  it('declares the supply tokens each product accepts', () => {
    const byId = Object.fromEntries(products.map(p => [p.id, p]));
    expect(byId['savings'].supplyTokens).toEqual(['USDS', 'DAI']);
    expect(byId['stusds'].supplyTokens).toEqual(['USDS']);
    for (const product of products.filter(p => p.kind === 'fixed')) {
      expect(product.supplyTokens).toEqual(['USDS', 'USDC', 'sUSDS']);
    }
  });

  it('derives network badges from static config within the family', () => {
    const byId = Object.fromEntries(products.map(p => [p.id, p]));
    expect(byId['savings'].networks).toEqual(PRODUCTION_FAMILY);
    expect(byId['stusds'].networks).toEqual([mainnet.id]);
    for (const product of products.filter(p => p.kind === 'vault')) {
      expect(product.networks).toEqual([mainnet.id]);
    }
  });

  it('keeps the registry static-length for the tenderly family too', () => {
    const tenderlyProducts = buildEarnProducts([TENDERLY_CHAIN_ID], TENDERLY_CHAIN_ID, REWARD_FIXTURES);
    expect(tenderlyProducts).toHaveLength(products.length);
  });
});
