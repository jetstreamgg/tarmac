import type { EarnProductKind } from '@/hooks';

/**
 * Outline-ring color keys the product family across Portfolio cards: Morpho
 * vaults blue, Pendle fixed-yield green, everything else (savings, rewards,
 * stUSDS, Spark vaults) a neutral gray. Shared by PositionCard and the
 * marketplace cards so the two never drift.
 */
export const RING_MORPHO = '#2973FF';
export const RING_PENDLE = '#1DD9BA';
export const RING_DEFAULT = '#7E7E8F';

/** The minimal identity both SuppliedPosition and EarnProductRow satisfy. */
export type ProductIdentity = { id: string; kind: EarnProductKind };

export const isMorphoVault = ({ id, kind }: ProductIdentity): boolean =>
  kind === 'vault' && id.startsWith('vault-morpho');

export const isPendleFixed = ({ kind }: ProductIdentity): boolean => kind === 'fixed';

export const productRingColor = (product: ProductIdentity): string =>
  isMorphoVault(product) ? RING_MORPHO : isPendleFixed(product) ? RING_PENDLE : RING_DEFAULT;

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
