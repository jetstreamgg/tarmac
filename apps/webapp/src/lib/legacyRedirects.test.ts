import { describe, it, expect } from 'vitest';
import { legacySearchToLocation } from './legacyRedirects';

const MORPHO_VAULT_ADDRESS = '0x74cb54e082411cfCAEADb00a0765625B10410DAa';
const MARKET_ADDRESS = '0x36d3ca43ae7939645c306e26603ce16e39a89192';
const REWARD_ADDRESS = '0x0650caf159c5a49f711e8169d4336ecb9b950275';

describe('legacySearchToLocation', () => {
  it('returns null when no widget param is present', () => {
    expect(legacySearchToLocation({})).toBeNull();
    expect(legacySearchToLocation({ network: 'ethereum', details: 'true' })).toBeNull();
  });

  it('maps widget=balances to the portfolio, not the landing heuristic', () => {
    expect(legacySearchToLocation({ widget: 'balances' })).toEqual({ to: '/portfolio', search: {} });
  });

  it('maps unknown widget values to / (legacy validator stripped them)', () => {
    expect(legacySearchToLocation({ widget: 'bogus' })).toEqual({ to: '/', search: {} });
  });

  it('maps simple module widgets straight to their target-IA paths', () => {
    expect(legacySearchToLocation({ widget: 'savings' })).toEqual({ to: '/earn/savings', search: {} });
    expect(legacySearchToLocation({ widget: 'stake' })).toEqual({ to: '/stake', search: {} });
  });

  it('maps every convert generation onto the single convert page', () => {
    expect(legacySearchToLocation({ widget: 'trade' })).toEqual({ to: '/convert', search: {} });
    expect(legacySearchToLocation({ widget: 'convert' })).toEqual({ to: '/convert', search: {} });
    for (const convert_module of ['psm', 'trade', 'upgrade', 'bogus']) {
      expect(legacySearchToLocation({ widget: 'convert', convert_module })).toEqual({
        to: '/convert',
        search: {}
      });
    }
  });

  it('maps legacy standalone upgrade onto convert on every network', () => {
    // Convert is available on the L2s too, so the old mainnet-only carve-out
    // (which dropped L2 upgrade links on the homepage) no longer applies.
    expect(legacySearchToLocation({ widget: 'upgrade' })).toEqual({ to: '/convert', search: {} });
    expect(legacySearchToLocation({ widget: 'upgrade', network: 'ethereum' })).toEqual({
      to: '/convert',
      search: { network: 'ethereum' }
    });
    expect(legacySearchToLocation({ widget: 'upgrade', network: 'base' })).toEqual({
      to: '/convert',
      search: { network: 'base' }
    });
  });

  it('collapses both expert URLs onto the flattened stUSDS page', () => {
    expect(legacySearchToLocation({ widget: 'expert' })).toEqual({ to: '/earn/stusds', search: {} });
    expect(legacySearchToLocation({ widget: 'expert', expert_module: 'stusds' })).toEqual({
      to: '/earn/stusds',
      search: {}
    });
  });

  it('keeps entity deep links pointed at their product pages', () => {
    expect(legacySearchToLocation({ widget: 'rewards', reward: REWARD_ADDRESS })).toEqual({
      to: `/earn/rewards/${REWARD_ADDRESS}`,
      search: {}
    });
    expect(
      legacySearchToLocation({ widget: 'vaults', vault_module: 'morpho', vault: MORPHO_VAULT_ADDRESS })
    ).toEqual({ to: `/earn/vaults/morpho/${MORPHO_VAULT_ADDRESS}`, search: {} });
    expect(
      legacySearchToLocation({ widget: 'fixed', fixed_module: 'market', market: MARKET_ADDRESS })
    ).toEqual({ to: `/earn/fixed/market/${MARKET_ADDRESS}`, search: {} });
  });

  describe('families with no page of their own land on the filtered marketplace (APP-542)', () => {
    it('filters the table to the family the link asked for', () => {
      expect(legacySearchToLocation({ widget: 'rewards' })).toEqual({
        to: '/earn',
        search: { product: 'rewards' }
      });
      expect(legacySearchToLocation({ widget: 'vaults' })).toEqual({
        to: '/earn',
        search: { product: 'vault' }
      });
      expect(legacySearchToLocation({ widget: 'fixed' })).toEqual({
        to: '/earn',
        search: { product: 'fixed' }
      });
    });

    it('filters rather than drops when the entity params are unusable', () => {
      // A provider with no vault address, an unknown provider (`spark`, the
      // pre-rename value), an unknown fixed_module: all still name a family.
      expect(legacySearchToLocation({ widget: 'vaults', vault_module: 'morpho' })).toEqual({
        to: '/earn',
        search: { product: 'vault' }
      });
      expect(
        legacySearchToLocation({ widget: 'vaults', vault_module: 'spark', vault: MORPHO_VAULT_ADDRESS })
      ).toEqual({ to: '/earn', search: { product: 'vault' } });
      expect(legacySearchToLocation({ widget: 'fixed', fixed_module: 'bogus' })).toEqual({
        to: '/earn',
        search: { product: 'fixed' }
      });
    });

    it('keeps the caller network alongside the product filter', () => {
      // The exact shape the sky.money CTAs are being pointed at.
      expect(legacySearchToLocation({ widget: 'fixed', network: 'ethereum' })).toEqual({
        to: '/earn',
        search: { network: 'ethereum', product: 'fixed' }
      });
    });
  });

  it('preserves non-navigation params and drops consumed and retired ones', () => {
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

    // input_amount/linked_action are retired in the target IA, and now drop
    // for every widget rather than only the ones that changed path.
    expect(legacySearchToLocation({ widget: 'stake', input_amount: '5', linked_action: 'savings' })).toEqual({
      to: '/stake',
      search: {}
    });
    expect(legacySearchToLocation({ widget: 'savings', network: 'base', input_amount: '5' })).toEqual({
      to: '/earn/savings',
      search: { network: 'base' }
    });
  });

  it('handles case-insensitive widget and module values', () => {
    expect(legacySearchToLocation({ widget: 'Trade' })).toEqual({ to: '/convert', search: {} });
    expect(legacySearchToLocation({ widget: 'VAULTS' })).toEqual({
      to: '/earn',
      search: { product: 'vault' }
    });
    expect(
      legacySearchToLocation({ widget: 'vaults', vault_module: 'MORPHO', vault: MORPHO_VAULT_ADDRESS })
    ).toEqual({ to: `/earn/vaults/morpho/${MORPHO_VAULT_ADDRESS}`, search: {} });
    expect(
      legacySearchToLocation({ widget: 'fixed', fixed_module: 'Market', market: MARKET_ADDRESS })
    ).toEqual({ to: `/earn/fixed/market/${MARKET_ADDRESS}`, search: {} });
  });
});
