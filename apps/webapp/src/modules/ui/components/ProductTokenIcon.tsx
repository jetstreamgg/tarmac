import { TokenIcon } from './TokenIcon';

/**
 * A token icon wrapped in its product-family outline ring. Presentational — the
 * ring color is passed in (from `productRingColor`), so this stays decoupled from
 * the product-family logic. Shared by the Portfolio/Earn cards and the
 * product-detail page headers so the ring treatment never drifts.
 */
export function ProductTokenIcon({
  symbol,
  ringColor,
  width = 40,
  className,
  showChainIcon = false
}: {
  symbol: string;
  /** Outline-ring color, e.g. from `productRingColor`. */
  ringColor: string;
  /** TokenIcon image size in px. */
  width?: number;
  /** Sizing class for the inner TokenIcon (e.g. `h-10 w-10`). */
  className?: string;
  showChainIcon?: boolean;
}) {
  return (
    <div
      className="w-fit rounded-full p-0.75"
      style={{ border: `2px solid ${ringColor}` }}
      data-testid="product-token-icon"
    >
      <TokenIcon token={{ symbol }} width={width} showChainIcon={showChainIcon} className={className} />
    </div>
  );
}
