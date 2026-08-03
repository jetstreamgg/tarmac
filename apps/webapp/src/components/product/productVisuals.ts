import type { EarnProductKind } from '@/hooks';

/**
 * The Iconbox / Status tint keys the product family wherever a product token
 * icon is shown — Portfolio cards, Earn marketplace cards, and the
 * product-detail page headers: Morpho vaults `info` (blue ring + dot), Pendle
 * fixed-yield `success` (green ring + dot), everything else (savings, rewards,
 * stUSDS, Spark vaults) the neutral default ring. Lives in components/product
 * so product modules import it "down" rather than from a sibling module.
 */
export const RING_PENDLE = '#1DD9BA';

/** The minimal identity both SuppliedPosition and EarnProductRow satisfy. */
export type ProductIdentity = { id: string; kind: EarnProductKind };

export const isMorphoVault = ({ id, kind }: ProductIdentity): boolean =>
  kind === 'vault' && id.startsWith('vault-morpho');

export const isPendleFixed = ({ kind }: ProductIdentity): boolean => kind === 'fixed';

/** Iconbox / Status `type` for a product's icon; undefined = default ring, no dot. */
export const productStatusType = (product: ProductIdentity): 'success' | 'info' | undefined =>
  isMorphoVault(product) ? 'info' : isPendleFixed(product) ? 'success' : undefined;

/**
 * Symbol to draw in a product's token icon. Rewards rows supply USDS but are
 * recognized by their reward token, encoded in the id ('rewards-spk' → SPK);
 * every other product uses its display token.
 */
export const productIconSymbol = ({
  id,
  kind,
  tokenSymbol
}: ProductIdentity & { tokenSymbol: string }): string =>
  kind === 'rewards' ? id.replace('rewards-', '').toUpperCase() : tokenSymbol;
