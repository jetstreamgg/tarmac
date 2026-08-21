import { useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Hover motion shared by the chart and its tooltip (Figma: Sky App: UI
 * 1598:76169). It lives here rather than in `Chart.tsx` because `ChartTooltip`
 * needs it too, and `Chart.tsx` imports the tooltip — reading it from there
 * would be a cycle.
 *
 * WHY THIS IS NOT A CSS TRANSITION
 *
 * The comp animates the dot, the rule, the lit window and the tooltip on quart
 * (`cubic-bezier(0.77, 0, 0.175, 1)`) — an ease-in-out. That reads correctly
 * for the comp, which moves a demo pointer between two fixed points and plays
 * the curve start to finish. A real hover never does: while the pointer is in
 * flight the target moves *every frame*, so every frame restarts the transition
 * from wherever the element got to — and only the first ~16ms of the curve is
 * ever used, which for an ease-in-out is its flattest stretch.
 *
 * Measured over one 16.7ms frame, the fraction of the remaining distance each
 * option covers:
 *
 *   quart ease-in-out @120ms    1.3%/frame   -> effective tau ~1250ms
 *   quart ease-in-out @500ms    0.1%/frame   -> effective tau ~25s
 *   ease-out @120ms            22.0%/frame   -> effective tau ~67ms
 *
 * So the "glide" was really a stall, and the faster the pointer moved the
 * further behind it fell — worst on the dense ranges, where the target shifts
 * every single frame. Shortening the duration does not fix it; the curve shape
 * does. What this needs is not a transition at all but a follower whose
 * velocity is proportional to the distance left to cover.
 */

/**
 * Time constant for the elements that report where the pointer is — the ringed
 * dot, the dashed rule and the tooltip.
 *
 * A first-order follower trails a *moving* target by `velocity x tau`, so this
 * number is what decides whether the dot feels attached to the cursor. At a
 * brisk drag (~1300px/s, measured) 45ms trails ~60px — five dot widths, and
 * plainly late. 16ms trails ~20px, which reads as attached while still taking
 * ~50ms to settle: enough to smooth the jump between two data points on the
 * sparse ranges (1W steps ~90px) without ever being what the eye waits for.
 *
 * The visible animation in the hover chrome is the tail, below — not this.
 */
export const TRACK_TAU_MS = 16;

/**
 * Time constant for the lit window — the "tail" of full-strength series around
 * the hover point. This is the piece that is *meant* to be seen animating, so
 * it lags several times the indicators.
 *
 * The comp's Mask (node 1598:76193) takes ~500ms between points, but that is a
 * discrete jump between two fixed positions, not continuous tracking: matching
 * it literally (tau 165) leaves the window ~150px behind during a brisk drag,
 * and since the window is only 44px wide it would then be lighting a stretch of
 * series nowhere near the point being hovered — actively misleading rather than
 * decorative. At 70 it trails visibly (~90px at a brisk drag, settling in
 * ~210ms) while still overlapping the point at ordinary pointer speeds.
 */
export const TAIL_TAU_MS = 70;

/** Quart, the easing the comp carries. Still right for discrete fades. */
export const HOVER_EASE = 'cubic-bezier(0.77, 0, 0.175, 1)';

/** Duration for those discrete fades (the dim mask's on/off). */
export const HOVER_FADE_MS = 120;

/**
 * Crossfade between the dimmed base series and the bright hover segment — the
 * reference chart runs `{duration: 0.4, ease: 'easeInOut'}` on both sides of
 * the swap, and that slow fade is most of what reads as "smooth" there.
 */
export const HOVER_CROSSFADE_MS = 400;
export const HOVER_CROSSFADE_EASE = 'cubic-bezier(0.42, 0, 0.58, 1)';

/** Below this the follower has arrived; snapping avoids an endless rAF tail. */
const SETTLED_PX = 0.05;
/** Longest frame the integrator will honour, so a stalled tab cannot teleport. */
const MAX_FRAME_MS = 64;

/**
 * Follows a moving target with exponential smoothing, handing `write` the
 * smoothed position each frame.
 *
 * Velocity is proportional to the distance remaining, so there is no start-up
 * cost: a large jump moves fast immediately and a small step settles at once.
 * That is what makes it track a per-frame-moving target where a transition
 * cannot. It is also frame-rate independent — `dt` drives the step, so the
 * motion looks the same at 60Hz and 120Hz.
 *
 * Whatever style property `write` touches is written imperatively and must NOT
 * also appear in the element's `style` prop: React only clears properties it
 * previously managed, so leaving it out entirely lets these writes survive the
 * re-render recharts fires on every mousemove.
 */
function useFollowWith<T extends SVGElement | HTMLElement>(
  x: number | null | undefined,
  y: number | null | undefined,
  tau: number,
  write: (node: T, x: number, y: number) => void
) {
  const ref = useRef<T | null>(null);
  const target = useRef<{ x: number; y: number } | null>(null);
  const current = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const lastFrameAt = useRef(0);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || x == null || y == null) {
      // Target lost (hover ended). Forget the position too, so a later
      // reacquisition places directly instead of gliding in from wherever the
      // last hover left off — which matters for followers that stay mounted
      // between hovers, like the lit segment.
      target.current = null;
      current.current = null;
      return;
    }

    target.current = { x, y };

    // First placement of this instance — and every placement under reduced
    // motion — lands directly. Animating the first one would fly the element in
    // from the origin of its coordinate space.
    if (current.current === null || reduceMotion) {
      current.current = { x, y };
      write(node, x, y);
      return;
    }

    // A loop already in flight will pick the new target up on its next frame.
    if (frame.current !== null) return;

    lastFrameAt.current = performance.now();
    const step = (now: number) => {
      const node = ref.current;
      const cur = current.current;
      const tgt = target.current;
      if (!node || !cur || !tgt) {
        frame.current = null;
        return;
      }
      const dt = Math.min(now - lastFrameAt.current, MAX_FRAME_MS);
      lastFrameAt.current = now;

      const k = 1 - Math.exp(-dt / tau);
      cur.x += (tgt.x - cur.x) * k;
      cur.y += (tgt.y - cur.y) * k;

      if (Math.abs(tgt.x - cur.x) < SETTLED_PX && Math.abs(tgt.y - cur.y) < SETTLED_PX) {
        cur.x = tgt.x;
        cur.y = tgt.y;
        write(node, cur.x, cur.y);
        frame.current = null;
        return;
      }
      write(node, cur.x, cur.y);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [x, y, tau, reduceMotion, write]);

  useLayoutEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  return ref;
}

const writeTransform = (node: SVGElement | HTMLElement, x: number, y: number) => {
  node.style.transform = `translate(${x}px, ${y}px)`;
};

/** The position follower: writes `transform` straight to the node each frame. */
export function useFollow<T extends SVGElement | HTMLElement>(
  x: number | null | undefined,
  y: number | null | undefined,
  tau: number
) {
  return useFollowWith<T>(x, y, tau, writeTransform);
}

const writeDashoffset = (node: SVGElement, x: number) => {
  node.style.strokeDashoffset = `${x}`;
};

/**
 * The same follower in arc-length space: smooths `stroke-dashoffset` on a path
 * whose dash window is what the viewer sees moving. Sliding the dash offset is
 * what keeps the lit window ON the curve — a translate would drag the whole
 * path sideways.
 */
export function useDashoffsetFollow<T extends SVGPathElement>(
  offset: number | null | undefined,
  tau: number
) {
  return useFollowWith<T>(offset, offset == null ? null : 0, tau, writeDashoffset);
}

/** The slice of SVGPathElement the sampler reads — narrow so tests can fake it. */
export type MeasurablePath = {
  getTotalLength(): number;
  getPointAtLength(distance: number): { x: number };
};

/**
 * Arc-length lookup table for a plotted series: `samples + 1` evenly spaced
 * distances along the path, each with the x it lands on. Series are functions
 * of x, so xs come out sorted and `arcLengthAtX` can binary-search them.
 */
export type ArcLut = { xs: number[]; lengths: number[]; total: number };

export function buildArcLut(path: MeasurablePath, samples = 256): ArcLut | null {
  // Environments without SVG layout (happy-dom) get no lut — and no crash.
  if (typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function') {
    return null;
  }
  const total = path.getTotalLength();
  // Pre-layout paths measure 0 — callers retry on the next frame.
  if (!total || !isFinite(total)) return null;
  const xs: number[] = [];
  const lengths: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const length = (total * i) / samples;
    lengths.push(length);
    xs.push(path.getPointAtLength(length).x);
  }
  return { xs, lengths, total };
}

/**
 * Distance along the stroke at which the series crosses `x` — what turns a
 * hover's x-coordinate into a dash-window position. Clamps outside the plot.
 */
export function arcLengthAtX(lut: ArcLut, x: number): number {
  const { xs, lengths } = lut;
  const last = xs.length - 1;
  if (x <= xs[0]) return lengths[0];
  if (x >= xs[last]) return lengths[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  const t = span > 0 ? (x - xs[lo]) / span : 0;
  return lengths[lo] + t * (lengths[hi] - lengths[lo]);
}
