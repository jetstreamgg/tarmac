import { VaultsIntent } from '@/lib/enums';
import { VaultProvider } from '@/hooks/vaults/types';

/**
 * Single source of truth tying a vault provider to its URL/routing identity:
 * the `vault_module` query-param value (what URL builders write) and the
 * `VaultsIntent` the detail routing keys off (what the validator selects).
 *
 * Keyed by `VaultProvider` so the maps are total over known providers at compile
 * time — adding a provider to the `VaultProvider` union surfaces a TS error here
 * until its `vault_module` value and intent are declared, so no URL builder,
 * validator, or detail switch can silently fall behind a new provider.
 */
const VAULT_MODULE_BY_PROVIDER: Record<VaultProvider, string> = {
  morpho: 'morpho'
};

const INTENT_BY_PROVIDER: Record<VaultProvider, VaultsIntent> = {
  morpho: VaultsIntent.MORPHO_VAULT_INTENT
};

const PROVIDERS = Object.keys(VAULT_MODULE_BY_PROVIDER) as VaultProvider[];

/** provider → `vault_module` URL value (for URL builders). */
export const vaultModuleForProvider = (provider: VaultProvider): string => VAULT_MODULE_BY_PROVIDER[provider];

/** `VaultsIntent` → provider. Total over known intents. */
export const providerForVaultsIntent = (intent: VaultsIntent): VaultProvider =>
  PROVIDERS.find(provider => INTENT_BY_PROVIDER[provider] === intent) as VaultProvider;

/**
 * `vault_module` value → provider, or `undefined` for an unrecognised value
 * (so the validator can reject it). Case-insensitive — values are canonically
 * lowercased.
 */
export const providerForVaultModule = (value: string): VaultProvider | undefined =>
  PROVIDERS.find(provider => VAULT_MODULE_BY_PROVIDER[provider] === value.toLowerCase());
