import { describe, it, expect } from 'vitest';
import { legacyPathToLocation, legacySearchToLocation } from './legacyRedirects';

const SPARK_VAULT_ADDRESS = '0x74cb54e082411cfCAEADb00a0765625B10410DAa';
const MARKET_ADDRESS = '0x36d3ca43ae7939645c306e26603ce16e39a89192';
const REWARD_ADDRESS = '0x0650caf159c5a49f711e8169d4336ecb9b950275';

describe('legacySearchToLocation', () => {
  it('returns null when no widget param is present', () => {
    expect(legacySearchToLocation({})).toBeNull();
    expect(legacySearchToLocation({ network: 'ethereum', details: 'true' })).toBeNull();
  });

  it('maps widget=balances to /', () => {
    expect(legacySearchToLocation({ widget: 'balances' })).toEqual({ to: '/', search: {} });
  });

  it('maps unknown widget values to / (legacy validator stripped them)', () => {
    expect(legacySearchToLocation({ widget: 'bogus' })).toEqual({ to: '/', search: {} });
  });

  it('maps simple module widgets to their paths', () => {
    expect(legacySearchToLocation({ widget: 'savings' })).toEqual({ to: '/savings', search: {} });
    expect(legacySearchToLocation({ widget: 'stake' })).toEqual({ to: '/stake', search: {} });
  });

  it('maps legacy standalone trade onto the convert page', () => {
    expect(legacySearchToLocation({ widget: 'trade' })).toEqual({ to: '/convert', search: {} });
  });

  it('maps legacy standalone upgrade onto convert only on mainnet', () => {
    expect(legacySearchToLocation({ widget: 'upgrade' })).toEqual({ to: '/convert', search: {} });
    expect(legacySearchToLocation({ widget: 'upgrade', network: 'ethereum' })).toEqual({
      to: '/convert',
      search: { network: 'ethereum' }
    });
    expect(legacySearchToLocation({ widget: 'upgrade', network: 'base' })).toEqual({
      to: '/',
      search: { network: 'base' }
    });
  });

  it('maps every convert_module value onto the single convert page', () => {
    expect(legacySearchToLocation({ widget: 'convert', convert_module: 'psm' })).toEqual({
      to: '/convert',
      search: {}
    });
    expect(legacySearchToLocation({ widget: 'convert', convert_module: 'trade' })).toEqual({
      to: '/convert',
      search: {}
    });
    expect(legacySearchToLocation({ widget: 'convert' })).toEqual({ to: '/convert', search: {} });
    expect(legacySearchToLocation({ widget: 'convert', convert_module: 'bogus' })).toEqual({
      to: '/convert',
      search: {}
    });
  });

  it('maps expert_module=stusds to /expert/stusds', () => {
    expect(legacySearchToLocation({ widget: 'expert', expert_module: 'stusds' })).toEqual({
      to: '/expert/stusds',
      search: {}
    });
    expect(legacySearchToLocation({ widget: 'expert' })).toEqual({ to: '/expert', search: {} });
  });

  it('maps vault_module + vault to the vault detail path', () => {
    expect(
      legacySearchToLocation({ widget: 'vaults', vault_module: 'sky', vault: SPARK_VAULT_ADDRESS })
    ).toEqual({ to: `/vaults/sky/${SPARK_VAULT_ADDRESS}`, search: {} });
  });

  it('falls back to the vaults overview without a vault address or with an unknown provider', () => {
    expect(legacySearchToLocation({ widget: 'vaults', vault_module: 'morpho' })).toEqual({
      to: '/vaults',
      search: {}
    });
    expect(
      legacySearchToLocation({ widget: 'vaults', vault_module: 'aave', vault: SPARK_VAULT_ADDRESS })
    ).toEqual({ to: '/vaults', search: {} });
  });

  it('maps fixed_module=market + market to the market detail path', () => {
    expect(
      legacySearchToLocation({ widget: 'fixed', fixed_module: 'market', market: MARKET_ADDRESS })
    ).toEqual({ to: `/fixed/market/${MARKET_ADDRESS}`, search: {} });
    expect(legacySearchToLocation({ widget: 'fixed' })).toEqual({ to: '/fixed', search: {} });
  });

  it('maps reward contract to the rewards detail path', () => {
    expect(legacySearchToLocation({ widget: 'rewards', reward: REWARD_ADDRESS })).toEqual({
      to: `/rewards/${REWARD_ADDRESS}`,
      search: {}
    });
    expect(legacySearchToLocation({ widget: 'rewards' })).toEqual({ to: '/rewards', search: {} });
  });

  it('preserves non-navigation params and drops consumed ones', () => {
    expect(
      legacySearchToLocation({
        widget: 'trade',
        network: 'ethereum',
        flow: 'revert',
        source_token: 'MKR',
        details: 'false'
      })
    ).toEqual({
      to: '/convert',
      search: { network: 'ethereum', flow: 'revert', source_token: 'MKR', details: 'false' }
    });
  });

  it('handles case-insensitive widget values', () => {
    expect(legacySearchToLocation({ widget: 'Trade' })).toEqual({ to: '/convert', search: {} });
  });
});

describe('legacyPathToLocation', () => {
  it('returns null for paths that survived the IA flip unchanged', () => {
    expect(legacyPathToLocation('/')).toBeNull();
    expect(legacyPathToLocation('/stake')).toBeNull();
    expect(legacyPathToLocation('/convert')).toBeNull();
    expect(legacyPathToLocation('/convert/psm')).toBeNull();
    expect(legacyPathToLocation('/convert/trade')).toBeNull();
    expect(legacyPathToLocation('/convert/upgrade')).toBeNull();
    expect(legacyPathToLocation('/seal-engine')).toBeNull();
    expect(legacyPathToLocation('/dev')).toBeNull();
  });

  it('returns null for target-IA and unknown paths', () => {
    expect(legacyPathToLocation('/portfolio')).toBeNull();
    expect(legacyPathToLocation('/earn')).toBeNull();
    expect(legacyPathToLocation('/earn/savings')).toBeNull();
    expect(legacyPathToLocation('/bogus')).toBeNull();
  });

  it('maps pre-flip module paths to their target-IA destinations', () => {
    expect(legacyPathToLocation('/balances')).toEqual({ to: '/portfolio', search: {} });
    expect(legacyPathToLocation('/savings')).toEqual({ to: '/earn/savings', search: {} });
    expect(legacyPathToLocation('/rewards')).toEqual({ to: '/earn/rewards', search: {} });
    expect(legacyPathToLocation('/vaults')).toEqual({ to: '/earn/vaults', search: {} });
    expect(legacyPathToLocation('/fixed')).toEqual({ to: '/earn/fixed', search: {} });
    expect(legacyPathToLocation('/expert')).toEqual({ to: '/earn/stusds', search: {} });
  });

  it('tolerates trailing slashes', () => {
    expect(legacyPathToLocation('/savings/')).toEqual({ to: '/earn/savings', search: {} });
  });

  it('keeps the reward contract as a path segment', () => {
    expect(legacyPathToLocation(`/rewards/${REWARD_ADDRESS}`)).toEqual({
      to: `/earn/rewards/${REWARD_ADDRESS}`,
      search: {}
    });
  });

  it('keeps vault provider and address as path segments when both are present', () => {
    expect(legacyPathToLocation(`/vaults/sky/${SPARK_VAULT_ADDRESS}`)).toEqual({
      to: `/earn/vaults/sky/${SPARK_VAULT_ADDRESS}`,
      search: {}
    });
    // A bare provider has no detail route to land on → vaults overview.
    expect(legacyPathToLocation('/vaults/sky')).toEqual({ to: '/earn/vaults', search: {} });
  });

  it('keeps the fixed market as path segments', () => {
    expect(legacyPathToLocation(`/fixed/market/${MARKET_ADDRESS}`)).toEqual({
      to: `/earn/fixed/market/${MARKET_ADDRESS}`,
      search: {}
    });
  });

  it('collapses both expert paths onto the flattened stUSDS page', () => {
    expect(legacyPathToLocation('/expert')).toEqual({ to: '/earn/stusds', search: {} });
    expect(legacyPathToLocation('/expert/stusds')).toEqual({ to: '/earn/stusds', search: {} });
  });

  it('drops unrecognised trailing segments and lands on the destination', () => {
    expect(legacyPathToLocation('/fixed/bogus')).toEqual({ to: '/earn/fixed', search: {} });
    expect(legacyPathToLocation(`/vaults/aave/${SPARK_VAULT_ADDRESS}`)).toEqual({
      to: '/earn/vaults',
      search: {}
    });
  });

  it('preserves incoming params and drops the retired ones', () => {
    expect(
      legacyPathToLocation('/savings', {
        network: 'base',
        flow: 'withdraw',
        input_amount: '5',
        linked_action: 'trade'
      })
    ).toEqual({ to: '/earn/savings', search: { network: 'base', flow: 'withdraw' } });
  });
});
