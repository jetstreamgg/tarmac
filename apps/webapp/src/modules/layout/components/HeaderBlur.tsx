/** How many layers the blur ramp is built from — see `.progressive-blur-bar`. */
const BLUR_LAYERS = 6;

/**
 * The sticky header's progressive blur: a stack of backdrop layers with
 * doubling radii, sitting behind the header content so the logo and nav pills
 * stay sharp while whatever scrolls under the bar goes gradually out of focus.
 *
 * Real elements rather than pseudo-elements because the ramp needs more than
 * the two an element can offer. Everything visual lives in
 * `.progressive-blur-bar` (globals.css), including why a single masked layer
 * can't produce a ramp.
 */
export function HeaderBlur() {
  return (
    <div aria-hidden data-testid="header-blur" className="progressive-blur-bar">
      {Array.from({ length: BLUR_LAYERS }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}
