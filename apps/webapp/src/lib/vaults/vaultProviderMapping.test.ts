import { describe, it, expect } from 'vitest';
import { VaultsIntent } from '@/lib/enums';
import { VaultProvider } from '@/hooks/vaults/types';
import {
  vaultModuleForProvider,
  vaultsIntentForProvider,
  vaultModuleForVaultsIntent,
  providerForVaultsIntent,
  providerForVaultModule,
  vaultsIntentForVaultModule
} from './vaultProviderMapping';

// [provider, vault_module value, intent] — the canonical triples.
const CASES: ReadonlyArray<[VaultProvider, string, VaultsIntent]> = [
  ['morpho', 'morpho', VaultsIntent.MORPHO_VAULT_INTENT],
  ['sky', 'sky', VaultsIntent.SKY_VAULT_INTENT]
];

describe('vaultProviderMapping', () => {
  describe('provider → value / intent', () => {
    it.each(CASES)('maps provider %s to its vault_module value and intent', (provider, value, intent) => {
      expect(vaultModuleForProvider(provider)).toBe(value);
      expect(vaultsIntentForProvider(provider)).toBe(intent);
    });
  });

  describe('value → provider / intent', () => {
    it.each(CASES)('resolves vault_module %s back to its provider and intent', (provider, value, intent) => {
      expect(providerForVaultModule(value)).toBe(provider);
      expect(vaultsIntentForVaultModule(value)).toBe(intent);
    });

    it('resolves case-insensitively (values are canonically lowercased)', () => {
      expect(providerForVaultModule('Sky')).toBe('sky');
      expect(providerForVaultModule('MORPHO')).toBe('morpho');
      expect(vaultsIntentForVaultModule('SKY')).toBe(VaultsIntent.SKY_VAULT_INTENT);
    });

    it('returns no provider/intent for an unrecognised value', () => {
      expect(providerForVaultModule('aave')).toBeUndefined();
      expect(vaultsIntentForVaultModule('aave')).toBeUndefined();
      expect(providerForVaultModule('')).toBeUndefined();
    });
  });

  describe('intent → provider / value', () => {
    it.each(CASES)('maps intent for %s back to its provider and value', (provider, value, intent) => {
      expect(providerForVaultsIntent(intent)).toBe(provider);
      expect(vaultModuleForVaultsIntent(intent)).toBe(value);
    });
  });

  describe('round-trips', () => {
    it.each(CASES)('provider → value → provider is identity for %s', provider => {
      expect(providerForVaultModule(vaultModuleForProvider(provider))).toBe(provider);
    });

    it.each(CASES)('provider → intent → provider is identity for %s', provider => {
      expect(providerForVaultsIntent(vaultsIntentForProvider(provider))).toBe(provider);
    });
  });
});
