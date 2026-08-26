import { cn } from '@/lib/cn';

/**
 * DS "Input / Amount" hairline — Figma component set `Input / Amount`
 * (5620:26710), states Default / Hover / Active / Filled / Validation. This is
 * the single authority for the recipe: `ModalAmountField` and
 * `StakeTakeoverAmountField` both render this component below their value row
 * instead of each re-deriving (or duplicating) their own divider.
 *
 * Figma spec, re-verified against the exported SVG stroke data per state:
 *  - Default/Filled: `#bcb6ef` @ 10%  → `--color-borderPrimary`
 *  - Hover:          `#bcb6ef` @ 30%  → `--color-borderTertiary`
 *  - Active/focus:   linear-gradient `#504DFF → #757DFF`, left→right
 *                     → `--color-slider-brand-start` / `-end` (the
 *                     `gradient-slider-brand` token the spec names)
 *  - Validation:     flat `#F83C3B`   → `--color-statusError`
 *
 * The rule is a 1px-tall element painted with `background`, not a `border` —
 * a plain `border-color` can't express the focus gradient, and fighting that
 * with `border-image` isn't worth it for one hairline.
 *
 * Precedence is error > focus > hover > rest:
 *  - Error is enforced in JS (the hover/focus classes are never emitted at
 *    all when `hasError`), so it can't lose to CSS specificity.
 *  - Focus beats hover "for free": focus paints an opaque `background-image`
 *    (the gradient) while hover only ever sets `background-color`, and
 *    `background-image` always paints above `background-color` on the same
 *    box regardless of which rule's generated CSS happens to sort later — so
 *    a focused+hovered field shows the gradient without relying on Tailwind's
 *    internal variant ordering.
 *
 * Both callers share one hover/focus signal: this element has no focusable
 * descendants of its own (it's an `aria-hidden` leaf), so it can't answer
 * `:hover`/`:focus-within` directly. Instead both callers wrap the whole
 * field in a `group`, and this component reads `group-hover`/
 * `group-focus-within` off that ancestor — one convention, no variant prop.
 */
export function AmountFieldHairline({ hasError, className }: { hasError: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        // `transition-colors` only animates the solid-color states
        // (rest⇄hover, and into/out of error) — CSS can't interpolate
        // between a flat color and the focus gradient, so that edge snaps.
        'h-px w-full shrink-0 transition-colors',
        hasError
          ? 'bg-statusError'
          : [
              'bg-borderPrimary',
              'group-hover:bg-borderTertiary',
              'group-focus-within:from-slider-brand-start group-focus-within:to-slider-brand-end group-focus-within:bg-linear-to-r'
            ],
        className
      )}
    />
  );
}
