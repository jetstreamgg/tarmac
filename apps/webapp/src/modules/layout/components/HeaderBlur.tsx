/**
 * The sticky header's progressive blur: one masked backdrop layer sitting
 * behind the header content, so the logo and nav pills stay sharp while
 * whatever scrolls under the bar goes gradually out of focus.
 *
 * A real element rather than a pseudo-element so it shows up in the inspector
 * under its own name — a hard edge on an earlier version of this was mistaken
 * for a header padding bug precisely because it wasn't inspectable. Everything
 * visual lives in `.progressive-blur-bar` (globals.css).
 */
export function HeaderBlur() {
  return <div aria-hidden data-testid="header-blur" className="progressive-blur-bar" />;
}
