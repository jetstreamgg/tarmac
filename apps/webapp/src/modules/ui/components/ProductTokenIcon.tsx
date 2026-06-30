import { TokenIcon } from './TokenIcon';

/**
 * A token icon wrapped in its product-family outline ring. Presentational — the
 * ring color is passed in (from `productRingColor`), so this stays decoupled from
 * the product-family logic. Shared by the Portfolio/Earn cards and the
 * product-detail page headers so the ring treatment never drifts.
 *
 * Pass `glowColor` to add a soft brand glow behind the icon (a `drop-shadow`, so
 * it hugs the round shape) — used on the product-detail headers; the cards omit
 * it and stay ring-only.
 */
export function ProductTokenIcon({
  symbol,
  ringColor,
  width = 40,
  className,
  showChainIcon = false,
  glowColor
}: {
  symbol: string;
  /** Outline-ring color, e.g. from `productRingColor`. */
  ringColor: string;
  /** TokenIcon image size in px. */
  width?: number;
  /** Sizing class for the inner TokenIcon (e.g. `h-10 w-10`). */
  className?: string;
  showChainIcon?: boolean;
  /** Optional brand glow behind the ring (product-detail headers). 6-digit hex. */
  glowColor?: string;
}) {
  return (
    <div
      className="w-fit rounded-full p-0.75"
      style={{
        border: `2px solid ${ringColor}`,
        // Soft brand glow hugging the icon. drop-shadow follows the round alpha
        // (circular, not boxy); a tight blur + ~80% alpha (`cc` hex) keeps it
        // close and visible. Tune the blur (closeness) / alpha here.
        filter: glowColor ? `drop-shadow(0 0 18px ${glowColor}cc)` : undefined
      }}
      data-testid="product-token-icon"
    >
      <TokenIcon token={{ symbol }} width={width} showChainIcon={showChainIcon} className={className} />
    </div>
  );
}
