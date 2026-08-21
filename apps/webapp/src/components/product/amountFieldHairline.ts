/**
 * DS "Input / Amount" hairline recipe — Figma component `Input / Amount`, states
 * Default / Hover / Active / Filled / Validation (comps 5620:26710 / 859:36036 /
 * 1104:128308). This is the single authority for the recipe; `ModalAmountField`
 * and `StakeTakeoverAmountField` both consume it instead of each re-deriving it.
 *
 * Rest sits on the low-alpha `glassBorder` token; focus-within brightens to
 * `borderTertiary`; a validation error overrides both with `statusError`,
 * regardless of focus. Only the hairline reddens on error — the amount, chips
 * and selector keep their normal colours per spec.
 */
export function amountFieldHairlineClasses(
  hasError: boolean,
  /**
   * The Tailwind focus-within selector that matches the caller's DOM: use the
   * default `'focus-within'` when the hairline element itself wraps the
   * focusable input, or `'group-focus-within'` when the hairline is a sibling
   * of the input behind a shared `group` ancestor.
   */
  focusWithinVariant: 'focus-within' | 'group-focus-within' = 'focus-within'
): string {
  return hasError ? 'border-statusError' : `border-glassBorder ${focusWithinVariant}:border-borderTertiary`;
}
