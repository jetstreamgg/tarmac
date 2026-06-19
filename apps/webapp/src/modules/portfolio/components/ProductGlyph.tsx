import { Morpho, Pendle } from '@/widgets';
import { RING_PENDLE, isMorphoVault, isPendleFixed, type ProductIdentity } from '../helpers/productVisuals';

/**
 * Provider badge shown beside a product name: the Morpho glyph for Morpho
 * vaults, a Pendle glyph in its brand tile for fixed-yield, nothing otherwise.
 * Shared by the position cards and the marketplace cards.
 */
export function ProductGlyph({ id, kind }: ProductIdentity) {
  if (isMorphoVault({ id, kind })) return <Morpho className="h-3.5 w-3.5 rounded-sm" />;
  if (isPendleFixed({ id, kind }))
    return (
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-white"
        style={{ backgroundColor: RING_PENDLE }}
      >
        <Pendle className="h-2.5 w-2.5" />
      </span>
    );
  return null;
}
