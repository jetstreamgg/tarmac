import { Token } from '../tokens/types';
import type { EarnRiskProfileId } from '../earn/types';

/** Vault data provider. Morpho today; Sky (sUSDT) added in APP-266. */
export type VaultProvider = 'morpho' | 'sky';

/**
 * Provider-neutral vault configuration.
 * The vault address (per chain) doubles as the unique identifier.
 */
export type VaultConfig = {
  /** Which provider supplies this vault's data and branding */
  provider: VaultProvider;
  /** Display name for the vault */
  name: string;
  /** Optional share-token symbol (e.g. `sUSDT`) for display/disambiguation */
  symbol?: string;
  /** The vault contract address mapping by chain ID (also the unique identifier) */
  vaultAddress: Record<number, `0x${string}`>;
  /** The underlying asset token */
  assetToken: Token;
  /**
   * Risk assessment + details copy for this vault (APP-396). Declared here so
   * registering a vault forces choosing its profile — vaults on the same
   * provider sit in different tiers (Flagship: moderate, Risk Capital:
   * aggressive per the APP-396 risk sheet).
   */
  riskProfile: EarnRiskProfileId;
};
