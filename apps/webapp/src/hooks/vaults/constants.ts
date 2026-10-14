import { MORPHO_VAULTS } from '../morpho/constants';
import { VaultConfig } from './types';

/**
 * Unified vault registry — every provider's vaults in one list (ADR-0001,
 * Module A). Consumers that render or look up "all vaults" (the Vaults tab list,
 * "My vaults", balance cards, deep-link resolution) should read from here rather
 * than a provider-specific array, so a new provider's vaults appear everywhere by
 * registration alone.
 */
export const VAULTS: VaultConfig[] = [...MORPHO_VAULTS];

/**
 * Provider-neutral lookup of a vault by its address on a given chain. Replaces
 * the Morpho-only `getMorphoVaultByAddress` for call sites that must resolve
 * vaults across providers.
 */
export function getVaultByAddress(address: `0x${string}`, chainId: number): VaultConfig | undefined {
  return VAULTS.find(vault => vault.vaultAddress[chainId]?.toLowerCase() === address.toLowerCase());
}
