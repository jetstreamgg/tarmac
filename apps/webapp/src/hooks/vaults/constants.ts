import { MORPHO_VAULTS } from '../morpho/constants';
import { SPARK_VAULTS } from './spark/constants';
import { VaultConfig } from './types';

/**
 * Feature flag for the sUSDT (Tether Savings) vault (APP-323). Read straight from
 * `import.meta.env` instead of importing `SUSDT_VAULT_ENABLED` from
 * `@/lib/constants`: that barrel pulls in Lingui `msg` macros, and the vnet-backed
 * hooks suite (vitest.hooks.config.ts) runs without the macro transform, so
 * importing it here would break those tests. `@/lib/constants` exports the same
 * constant (same expression) for the rest of the app.
 *
 * Optional-chain `import.meta.env?.` (matching the sibling spark/morpho constants):
 * the `@/hooks` barrel is imported by plain-Node tsx scripts (e.g. the e2e
 * `fund-accounts.ts`) where Vite never defines `import.meta.env`, so a direct
 * `.VITE_…` read would throw at module load.
 */
const SUSDT_VAULT_ENABLED = import.meta.env?.VITE_SUSDT_VAULT_ENABLED === 'true';

/**
 * Unified vault registry — every provider's vaults in one list (ADR-0001,
 * Module A). Consumers that render or look up "all vaults" (the Vaults tab list,
 * "My vaults", balance cards, deep-link resolution) should read from here rather
 * than a provider-specific array, so a new provider's vaults appear everywhere by
 * registration alone.
 *
 * The sUSDT (Tether Savings) vault is gated behind `SUSDT_VAULT_ENABLED`: with
 * the flag off it is absent from this list, so it disappears from every "all
 * vaults" consumer and `getVaultByAddress` no longer resolves it (APP-323).
 */
export const VAULTS: VaultConfig[] = [...MORPHO_VAULTS, ...(SUSDT_VAULT_ENABLED ? SPARK_VAULTS : [])];

/**
 * Provider-neutral lookup of a vault by its address on a given chain. Replaces
 * the Morpho-only `getMorphoVaultByAddress` for call sites that must resolve
 * vaults across providers.
 */
export function getVaultByAddress(address: `0x${string}`, chainId: number): VaultConfig | undefined {
  return VAULTS.find(vault => vault.vaultAddress[chainId]?.toLowerCase() === address.toLowerCase());
}
