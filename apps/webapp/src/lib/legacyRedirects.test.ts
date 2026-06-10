import { describe, it, expect } from 'vitest';
import { legacySearchToLocation } from './legacyRedirects';

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

  it('maps legacy standalone trade into the convert trade submodule', () => {
    expect(legacySearchToLocation({ widget: 'trade' })).toEqual({ to: '/convert/trade', search: {} });
  });

  it('maps legacy standalone upgrade into convert only on mainnet', () => {
    expect(legacySearchToLocation({ widget: 'upgrade' })).toEqual({ to: '/convert/upgrade', search: {} });
    expect(legacySearchToLocation({ widget: 'upgrade', network: 'ethereum' })).toEqual({
      to: '/convert/upgrade',
      search: { network: 'ethereum' }
    });
    expect(legacySearchToLocation({ widget: 'upgrade', network: 'base' })).toEqual({
      to: '/',
      search: { network: 'base' }
    });
  });

  it('maps convert_module values to convert subroutes', () => {
    expect(legacySearchToLocation({ widget: 'convert', convert_module: 'psm' })).toEqual({
      to: '/convert/psm',
      search: {}
    });
    expect(legacySearchToLocation({ widget: 'convert', convert_module: 'trade' })).toEqual({
      to: '/convert/trade',
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
      to: '/convert/trade',
      search: { network: 'ethereum', flow: 'revert', source_token: 'MKR', details: 'false' }
    });
  });

  it('handles case-insensitive widget values', () => {
    expect(legacySearchToLocation({ widget: 'Trade' })).toEqual({ to: '/convert/trade', search: {} });
  });
});
