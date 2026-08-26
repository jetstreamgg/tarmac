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
 * Lag constant for the elements that report where the pointer is — the ringed
 * dot, the dashed rule and the tooltip — when the hover is scrubbing WITHIN a
 * segment, i.e. when the snapped point barely moves between frames.
 *
 * A follower trails a *moving* target by `velocity x lag`, so this number is
 * what decides whether the indicators feel attached to the cursor. At a brisk
 * drag (~1300px/s, measured) 45ms trails ~60px — five dot widths, and plainly
 * late. 16ms trails ~20px, which reads as attached while still taking ~40ms to
 * settle. It is the FLOOR of the paced band below, not a fixed setting.
 */
export const TRACK_RESPONSE_MIN_MS = 16;

/**
 * ...and its ceiling, plus the pace that fills the band between them.
 *
 * recharts snaps the hover to a data point, so on a sparse range the
 * indicators do not follow the pointer at all — they sit still and then step
 * a whole point interval at once. A single lag constant cannot serve both
 * cases: small enough to feel attached while scrubbing is small enough to make
 * that step read as a jump, and large enough to animate the step is large
 * enough to trail the pointer half a plot on the dense ranges.
 *
 * So the step itself is the pace signal. Each time the target actually moves,
 * the response is set from how far it moved: a per-frame scrub of a couple of
 * px stays at the floor (attached, as before), while a point-to-point hop of
 * ~130px on the weekly range gets the full 100ms — a critically damped hop,
 * whose S-curve is the easeInOut the comp carries, settling in ~215ms.
 *
 * This is the same distance-paced idea as `tailResponse`, keyed off the
 * observed step rather than the measured point spacing, because the cursor is
 * a recharts-owned element that never sees the series geometry.
 */
export const TRACK_RESPONSE_MAX_MS = 100;
export const TRACK_PACE_MS_PER_PX = 0.8;

/** Spring lag constant for an indicator whose target just moved `step` px. */
export function trackResponse(step: number): number {
  return Math.min(Math.max(step * TRACK_PACE_MS_PER_PX, TRACK_RESPONSE_MIN_MS), TRACK_RESPONSE_MAX_MS);
}

/**
 * Response time for the lit window — the "tail" of full-strength series that
 * trails the cursor along the curve. This is the piece that is *meant* to be
 * seen animating, so it is slower than the indicators AND runs on the spring
 * integrator rather than the exponential one: an exponential spends its speed
 * the instant the target moves and only its slow settle is ever visible,
 * which read as a jump. The spring starts each move from zero velocity — a
 * beat of hesitation before it follows — accelerates, and eases in.
 *
 * The value is the spring's lag time constant (2/ω): a moving target trails
 * by `velocity x response`, and a standing-start hop settles in about 3x
 * this. 150 is derived from the reference chart, whose overlay tweens between
 * points with `{duration: 0.4, ease: 'easeInOut'}` — a 400ms zero-velocity
 * hop, which is what a ~150ms spring plays.
 */
export const TAIL_RESPONSE_MS = 150;

/**
 * A time constant alone paces every hop to the same DURATION, so a sparse
 * series' 100px hop travels at ten times the speed of a dense series' 10px
 * one — which is why only the weekly ranges read as jumpy. `tailResponse`
 * paces by DISTANCE instead: ~2ms of lag constant per px of point spacing
 * holds the perceived speed roughly level across ranges. The floor is the
 * reference-derived constant above (dense series never get twitchier than the
 * reference); the cap keeps the sparsest series (portfolio statistics, 7-8
 * points) from crawling and trailing the cursor by half the plot.
 */
export const TAIL_PACE_MS_PER_PX = 2;
export const TAIL_RESPONSE_MAX_MS = 300;

/** Spring lag constant for a series whose points sit `spacingArc` px apart. */
export function tailResponse(spacingArc: number): number {
  return Math.min(Math.max(spacingArc * TAIL_PACE_MS_PER_PX, TAIL_RESPONSE_MS), TAIL_RESPONSE_MAX_MS);
}

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
/** The two axes, so the spring step can be written once instead of twice. */
const AXES = ['x', 'y'] as const;

/**
 * Follows a moving target, handing `write` the smoothed position each frame.
 *
 * Two integrators, chosen by `mode`:
 *
 * - `'exp'` (first-order): velocity is proportional to the distance remaining,
 *   so there is no start-up cost — a large jump moves fast immediately and a
 *   small step settles at once. Right for indicators that must feel ATTACHED
 *   to the cursor (dot, rule, tooltip): the motion is over before the eye
 *   waits for it.
 * - `'spring'` (critically damped second-order): starts from zero velocity,
 *   accelerates, and eases into arrival — the S-curve of an easeInOut tween,
 *   but restartable mid-flight, so it also tracks a per-frame-moving target.
 *   Right for the piece that is meant to be SEEN travelling (the lit window):
 *   an exponential hop between two data points spends its speed instantly and
 *   shows only the settle, which reads as a jump.
 *
 * `time` is the lag constant in ms: a target moving at `v` px/ms trails by
 * `v x time` in steady state for both modes (for the spring it is 2/ω).
 * Both are frame-rate independent — `dt` drives the step, so the motion looks
 * the same at 60Hz and 120Hz.
 *
 * Whatever style property `write` touches is written imperatively and must NOT
 * also appear in the element's `style` prop: React only clears properties it
 * previously managed, so leaving it out entirely lets these writes survive the
 * re-render recharts fires on every mousemove.
 */
function useFollowWith<T extends SVGElement | HTMLElement>(
  x: number | null | undefined,
  y: number | null | undefined,
  time: number | ((step: number) => number),
  mode: 'exp' | 'spring',
  write: (node: T, x: number, y: number) => void
) {
  const ref = useRef<T | null>(null);
  const target = useRef<{ x: number; y: number } | null>(null);
  const current = useRef<{ x: number; y: number } | null>(null);
  const velocity = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);
  const lastFrameAt = useRef(0);
  // The lag constant in force for the move in flight. Held in a ref because a
  // paced follower re-derives it from each step the target takes, and the loop
  // must keep using it for frames where the target does not move.
  const response = useRef(typeof time === 'number' ? time : time(0));
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (x == null || y == null) {
      // Target lost (hover ended). Forget the position too, so a later
      // reacquisition places directly instead of gliding in from wherever the
      // last hover left off — which matters for followers that stay mounted
      // between hovers, like the lit segment.
      target.current = null;
      current.current = null;
      return;
    }

    const previous = target.current;
    target.current = { x, y };
    if (!node) {
      // The element is unmounted but the target is live — keep tracking it, so
      // the node-identity effect below can place a remounted element. Clearing
      // the target here is what used to strand the tooltip at the layer origin:
      // a dismissal that landed in the same commit as a coordinate change wiped
      // it, and the remount (same coordinate, so no re-run here) had nothing to
      // place at.
      current.current = null;
      return;
    }
    if (typeof time === 'number') {
      response.current = time;
    } else if (previous) {
      // Pace this move by how far the snapped target jumped. Only genuine
      // moves land here: identical x/y do not re-run the effect at all, so an
      // in-flight hop is never re-paced (and cut short) by the mousemoves that
      // keep reporting the same point.
      response.current = time(Math.hypot(x - previous.x, y - previous.y));
    }

    // First placement of this instance — and every placement under reduced
    // motion — lands directly. Animating the first one would fly the element in
    // from the origin of its coordinate space.
    if (current.current === null || reduceMotion) {
      current.current = { x, y };
      velocity.current = { x: 0, y: 0 };
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
      const vel = velocity.current;
      const tau = response.current;

      if (mode === 'spring') {
        // Critically damped, integrated in closed form rather than stepped:
        // with e = position - target, e(t) = (e0 + (v0 + ω e0) t) e^-ωt. That is
        // exact for a target that holds still over the frame and stable at any
        // ω, which a stepped integrator is not — at the 16ms floor an explicit
        // step's 2ω·dt term exceeds 1 and the follower blows up.
        const omega = 2 / tau;
        const decay = Math.exp(-omega * dt);
        for (const axis of AXES) {
          const error = cur[axis] - tgt[axis];
          const slope = vel[axis] + omega * error;
          const settled = (error + slope * dt) * decay;
          vel[axis] = (slope - omega * (error + slope * dt)) * decay;
          cur[axis] = tgt[axis] + settled;
        }
      } else {
        const k = 1 - Math.exp(-dt / tau);
        cur.x += (tgt.x - cur.x) * k;
        cur.y += (tgt.y - cur.y) * k;
      }

      const still =
        Math.abs(tgt.x - cur.x) < SETTLED_PX &&
        Math.abs(tgt.y - cur.y) < SETTLED_PX &&
        // A spring can cross the target carrying speed; arrival needs both.
        Math.abs(vel.x) * tau < SETTLED_PX &&
        Math.abs(vel.y) * tau < SETTLED_PX;
      if (still) {
        cur.x = tgt.x;
        cur.y = tgt.y;
        velocity.current = { x: 0, y: 0 };
        write(node, cur.x, cur.y);
        frame.current = null;
        return;
      }
      write(node, cur.x, cur.y);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [x, y, time, mode, reduceMotion, write]);

  // A remounted element with an UNCHANGED target slips past the effect above —
  // its deps are the coordinates — and would render unwritten at its
  // container's origin. The tooltip panel does exactly this: recharts keeps
  // the content component mounted (and the last coordinate) while inactive, so
  // ending the hover and resuming it on the same snapped point remounts the
  // panel with identical x/y — and the card sat visible at the screen's
  // top-left. Runs every render; acts only when the node is a new element.
  const placedNode = useRef<T | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || placedNode.current === node) return;
    placedNode.current = node;
    const tgt = target.current;
    if (!tgt) return;
    current.current = { ...tgt };
    velocity.current = { x: 0, y: 0 };
    write(node, tgt.x, tgt.y);
  });

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

/**
 * The hover-indicator follower — the dot, the dashed rule and the tooltip.
 *
 * Spring dynamics on a step-paced lag constant (`trackResponse`): a scrub
 * inside one segment stays at the 16ms floor and reads as attached, while the
 * step onto the next data point plays as a zero-velocity, ease-into-arrival
 * hop instead of a teleport. Writes `transform` each frame.
 */
export function useFollow<T extends SVGElement | HTMLElement>(
  x: number | null | undefined,
  y: number | null | undefined
) {
  return useFollowWith<T>(x, y, trackResponse, 'spring', writeTransform);
}

const writeDashoffset = (node: SVGElement, x: number) => {
  node.style.strokeDashoffset = `${x}`;
};

/**
 * The follower in arc-length space: smooths `stroke-dashoffset` on a path
 * whose dash window is what the viewer sees moving. Sliding the dash offset is
 * what keeps the lit window ON the curve — a translate would drag the whole
 * path sideways. Spring dynamics, because this hop is the visible animation —
 * see the mode notes on `useFollowWith` and `TAIL_RESPONSE_MS`.
 */
export function useDashoffsetFollow<T extends SVGPathElement>(
  offset: number | null | undefined,
  response: number
) {
  return useFollowWith<T>(offset, offset == null ? null : 0, response, 'spring', writeDashoffset);
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
