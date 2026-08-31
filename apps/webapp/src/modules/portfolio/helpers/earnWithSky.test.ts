import { describe, expect, it } from 'vitest';
import type { EarnProductRow } from '@/hooks';
import { Intent } from '@/lib/enums';
import { buildEarnWithSkyProducts, type StakeSummary } from './earnWithSky';

const row = (over: Partial<EarnProductRow>): EarnProductRow => ({
  id: 'x',
  kind: 'savings',
  riskProfile: 'savings',
  intent: Intent.SAVINGS_INTENT,
  name: 'X',
  tokenSymbol: 'USDS',
  supplyTokens: ['USDS'],
  risk: 'low',
  networks: [1],
  detailPath: '/earn/savings',
  rate: { value: 0.0375, formatted: '3.75%' },
  rate30d: { value: 0.036, formatted: '3.60%' },
  isLoading: false,
  error: null,
  ...over
});

const savings = row({ id: 'savings', supplyTokens: ['USDS', 'USDC', 'USDT'] });
const flagship = row({
  id: 'vault-morpho-1',
  kind: 'vault',
  riskProfile: 'vault-flagship',
  supplyTokens: ['USDS'],
  detailPath: '/earn/vaults/morpho/1',
  rate: { value: 0.0591, formatted: '5.91%' }
});
const riskCapital = row({
  id: 'vault-morpho-2',
  kind: 'vault',
  riskProfile: 'vault-risk-capital',
  supplyTokens: ['USDT', 'USDS'],
  detailPath: '/earn/vaults/morpho/2',
  rate: { value: 0.045, formatted: '4.50%' }
});
const rewards = row({ id: 'rewards-spk', kind: 'rewards', riskProfile: 'rewards-spk' });

const stake: StakeSummary = {
  rate: { value: 0.105, formatted: '10.50%' },
  isLoading: false,
  isAvailable: true
};

describe('buildEarnWithSkyProducts', () => {
  it('builds the three groups in design order from the matching rows', () => {
    const products = buildEarnWithSkyProducts([rewards, flagship, savings, riskCapital], stake);

    expect(products.map(p => p.id)).toEqual(['savings', 'vaults', 'stake']);
  });

  it('maps the savings row straight through', () => {
    const [product] = buildEarnWithSkyProducts([savings], stake);

    expect(product).toMatchObject({
      id: 'savings',
      rate: savings.rate,
      isBestOf: false,
      supplyTokens: ['USDS', 'USDC', 'USDT'],
      riskProfile: 'savings',
      to: { path: '/earn/savings' }
    });
  });

  it('advertises the best vault rate with that vault’s risk, over the union of supply tokens', () => {
    const [product] = buildEarnWithSkyProducts([riskCapital, flagship], { ...stake, isAvailable: false });

    expect(product).toMatchObject({
      id: 'vaults',
      rate: { value: 0.0591, formatted: '5.91%' },
      isBestOf: true,
      supplyTokens: ['USDT', 'USDS'],
      riskProfile: 'vault-flagship',
      to: { path: '/earn', search: { product: 'vault' }, hash: 'earn-opportunities' }
    });
  });

  it('does not say "up to" for a single vault', () => {
    const [product] = buildEarnWithSkyProducts([flagship], { ...stake, isAvailable: false });

    expect(product.isBestOf).toBe(false);
  });

  it('is loading while any vault is', () => {
    const [product] = buildEarnWithSkyProducts([flagship, { ...riskCapital, isLoading: true }], stake);

    expect(product.isLoading).toBe(true);
  });

  it('routes Stake to the Stake page with SKY as its supply token', () => {
    const [product] = buildEarnWithSkyProducts([], stake);

    expect(product).toMatchObject({
      id: 'stake',
      rate: stake.rate,
      supplyTokens: ['SKY'],
      riskProfile: 'stake',
      to: { path: '/stake' }
    });
  });

  it('omits groups with nothing behind them', () => {
    expect(buildEarnWithSkyProducts([rewards], { ...stake, isAvailable: false })).toEqual([]);
    expect(buildEarnWithSkyProducts([savings], { ...stake, isAvailable: false }).map(p => p.id)).toEqual([
      'savings'
    ]);
  });
});
