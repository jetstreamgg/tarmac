import { describe, it, expect } from 'vitest';
import { VaultsIntent } from '@/lib/enums';
import { VaultProvider } from '@/hooks/vaults/types';
import {
  vaultModuleForProvider,
  providerForVaultsIntent,
  providerForVaultModule
} from './vaultProviderMapping';

// [provider, vault_module value, intent] — the canonical triples.
const CASES: ReadonlyArray<[VaultProvider, string, VaultsIntent]> = [
  ['morpho', 'morpho', VaultsIntent.MORPHO_VAULT_INTENT]
];

describe('vaultProviderMapping', () => {
  describe('provider → value', () => {
    it.each(CASES)('maps provider %s to its vault_module value', (provider, value) => {
      expect(vaultModuleForProvider(provider)).toBe(value);
    });
  });

  describe('value → provider', () => {
    it.each(CASES)('resolves vault_module %s back to its provider', (provider, value) => {
      expect(providerForVaultModule(value)).toBe(provider);
    });

    it('resolves case-insensitively (values are canonically lowercased)', () => {
      expect(providerForVaultModule('Morpho')).toBe('morpho');
      expect(providerForVaultModule('MORPHO')).toBe('morpho');
    });

    it('returns no provider for an unrecognised value', () => {
      expect(providerForVaultModule('aave')).toBeUndefined();
      expect(providerForVaultModule('')).toBeUndefined();
    });
  });

  describe('intent → provider', () => {
    it.each(CASES)('maps intent for %s back to its provider', (provider, _value, intent) => {
      expect(providerForVaultsIntent(intent)).toBe(provider);
    });
  });

  describe('round-trips', () => {
    it.each(CASES)('provider → value → provider is identity for %s', provider => {
      expect(providerForVaultModule(vaultModuleForProvider(provider))).toBe(provider);
    });
  });
});
