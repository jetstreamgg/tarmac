import { Token, steakhousePrimeInstantVaultAddress, TOKENS } from '@jetstreamgg/sky-hooks';

/**
 * Configuration for a Morpho vault
 */
export type MorphoVaultConfig = {
  /** Display name for the vault */
  name: string;
  /** The vault contract address mapping by chain ID (also serves as the unique identifier) */
  vaultAddress: Record<number, `0x${string}`>;
  /** The underlying asset token */
  assetToken: Token;
};

/**
 * List of all supported Morpho vaults
 * To add a new vault, simply add a new entry to this array
 */
export const MORPHO_VAULTS: MorphoVaultConfig[] = [
  {
    name: 'Steakhouse Prime Instant',
    vaultAddress: steakhousePrimeInstantVaultAddress,
    assetToken: TOKENS.usdc
  }
  // Add more vaults here as needed:
  // {
  //   name: 'Another Vault Name',
  //   vaultAddress: anotherVaultAddress,
  //   assetToken: TOKENS.usds
  // }
];

/**
 * Get a Morpho vault config by its address for a specific chain
 */
export function getMorphoVaultByAddress(
  address: `0x${string}`,
  chainId: number
): MorphoVaultConfig | undefined {
  return MORPHO_VAULTS.find(vault => vault.vaultAddress[chainId]?.toLowerCase() === address.toLowerCase());
}
