/**
 * Hover motion shared by the chart and its tooltip (Figma: Sky App: UI
 * 1598:76169).
 *
 * The comp moves the cursor line, the ringed dot, the lit window and the
 * tooltip panel as one: they leave and land on the same keyframes, on quart.
 * One duration and easing across all four is what buys that. They live here
 * rather than in `Chart.tsx` because `ChartTooltip` needs them too, and
 * `Chart.tsx` imports the tooltip — reading them from there would be a cycle.
 *
 * The comp's own moves run ~500ms, but that figure is the DEMO POINTER's travel
 * between two far-apart data points, not an interaction spec: a real hover is
 * already where the user put it, and gliding for half a second behind the mouse
 * reads as lag rather than motion. The glide is therefore short enough to be
 * read as tracking — it smooths the jump from one datum to the next without
 * ever being what the eye waits for. (User call, on the 1598:76169 scope.)
 */
export const HOVER_TRACK_MS = 120;

/** Quart, the easing every move in the comp carries. */
export const HOVER_EASE = 'cubic-bezier(0.77, 0, 0.175, 1)';

/** Tooltip label/value crossfade — ~96ms in the comp. */
export const HOVER_FADE_MS = 100;
