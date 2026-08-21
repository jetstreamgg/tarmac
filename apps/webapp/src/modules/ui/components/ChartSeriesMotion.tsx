import { useLayoutEffect, useRef, useState, useId } from 'react';
import {
  DefaultZIndexes,
  ZIndexLayer,
  useActiveTooltipCoordinate,
  useChartHeight,
  useChartWidth,
  useIsTooltipActive
} from 'recharts';
import { useReducedMotion } from 'motion/react';
import {
  ArcLut,
  arcLengthAtX,
  buildArcLut,
  HOVER_CROSSFADE_EASE,
  HOVER_CROSSFADE_MS,
  tailResponse,
  useDashoffsetFollow
} from './chartMotion';

/**
 * The series' entrance reveal (Figma: Sky App: UI 1598:77307). Not recharts'
 * built-in clip-rect wipe: the reference draws the stroke tip-first along the
 * curve — `strokeDasharray = total` with `strokeDashoffset` run `total → 0` —
 * while the gradient fill wipes in under it behind a growing clipPath. The
 * dash draw is what makes steep segments appear at the speed the curve
 * travels, where a clip edge uncovers them in one vertical slice.
 */
const REVEAL_DURATION_MS = 900;
/**
 * The same draw, replayed when the series is swapped for another one — the
 * Rate|TVL switch in the tabs comp (Figma: Sky App: UI 1598:76322) draws the
 * incoming series over ~600ms.
 */
const RE_REVEAL_DURATION_MS = 600;
const REVEAL_EASING = 'cubic-bezier(0.77,0,0.175,1)';

/** How much of the series' alpha survives outside the hover segment. */
const DIMMED_ALPHA = 0.4;

/**
 * Shortest the lit segment gets, in px of arc length — the DS mock's window
 * measures ~45px across (Figma 5391:44830), and dense series stay there.
 * On sparse series the piece grows gently with the point spacing (half a
 * point interval on top of the base), so a longer hop moves a longer piece —
 * capped well short of the full neighbour-to-neighbour span, which was tried
 * and read as an overgrown slab.
 */
const SEGMENT_WINDOW = 44;
const SEGMENT_WINDOW_MAX = 96;
const WINDOW_PER_SPACING = 0.5;

/** Lit-segment length for a series whose points sit `spacingArc` px apart. */
export function segmentLength(spacingArc: number): number {
  return Math.min(SEGMENT_WINDOW + spacingArc * WINDOW_PER_SPACING, SEGMENT_WINDOW_MAX);
}

/** Bounded retries for reading a path that hasn't laid out yet (length 0). */
const MAX_MEASURE_TRIES = 30;

const findSeriesPaths = (probe: SVGGElement | null) => {
  const svg = probe?.ownerSVGElement;
  return {
    curve: svg?.querySelector<SVGPathElement>('path.recharts-area-curve') ?? null,
    fill: svg?.querySelector<SVGPathElement>('path.recharts-area-area') ?? null,
    layer: svg?.querySelector<SVGGElement>('g.recharts-area') ?? null
  };
};

/**
 * Hover + entrance motion for the plotted series, ported from the reference
 * chart (app.perena.org's Historical APY card) onto recharts' rendered SVG.
 *
 * Hovering dims the whole series and crossfades in a duplicate of the stroke
 * whose dash window exposes only the segment around the hover point. The
 * window is measured in ARC LENGTH along the stroke — a dash on a copy of the
 * live path — so the lit segment hugs the curve exactly; the x-space mask this
 * replaces cut a vertical band through fill and stroke alike. The window then
 * slides between points in dash-offset space on the spring follower
 * (chartMotion.ts) — an S-curve hop, like the tween the reference runs.
 *
 * Renders inside the AreaChart so recharts' chart-context hooks resolve; the
 * bright segment sits on the `line` z-layer — above the Area (100), below the
 * dashed cursor (1100) and the active dot (1200).
 */
export function SeriesMotionLayer({
  color,
  strokeWidth,
  seriesKey,
  data
}: {
  color: string;
  strokeWidth: number;
  /** Same identity the Area is keyed on; a change replays the entrance draw. */
  seriesKey?: string;
  /** The plotted rows — only a dependency for re-measuring the path. */
  data: unknown[];
}) {
  const isActive = useIsTooltipActive();
  const coordinate = useActiveTooltipCoordinate();
  const width = useChartWidth();
  const height = useChartHeight();
  const reduceMotion = useReducedMotion();
  const clipId = useId();
  // Rendered outside the z-index portal so it exists from the first commit —
  // its only job is reaching the chart's <svg> to find the series paths.
  const probeRef = useRef<SVGGElement>(null);
  const clipRectRef = useRef<SVGRectElement>(null);
  const [geom, setGeom] = useState<{ d: string; lut: ArcLut } | null>(null);
  // The hover chrome waits for the entrance draw — a lit window sliding along
  // a half-drawn line would light series that isn't there yet.
  const [revealDone, setRevealDone] = useState(false);

  // Re-measure the live path whenever anything that reshapes it changes. The
  // rAF retry covers the commits recharts spends filling its z-index portals
  // (the Area's paths land a couple of frames after ours) and the pre-layout
  // frame where getTotalLength() is still 0.
  useLayoutEffect(() => {
    let raf: number | null = null;
    let tries = 0;
    const retry = () => {
      if (tries++ < MAX_MEASURE_TRIES) raf = requestAnimationFrame(measure);
    };
    const measure = () => {
      raf = null;
      const { curve } = findSeriesPaths(probeRef.current);
      const d = curve?.getAttribute('d');
      if (!curve || !d) return retry();
      const lut = buildArcLut(curve);
      if (!lut) return retry();
      setGeom(prev => (prev?.d === d ? prev : { d, lut }));
    };
    measure();
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [seriesKey, data, width, height]);

  // Entrance draw: once per seriesKey, on the live recharts nodes. Lengths are
  // read from the DOM rather than `geom`, which can be a commit stale here.
  const revealedKey = useRef<string | null>(null);
  const hasRevealedOnce = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useLayoutEffect(() => {
    const key = seriesKey ?? '';
    // A resize re-measures geom but must not replay the entrance.
    if (revealedKey.current === key) return;
    const { curve, fill } = findSeriesPaths(probeRef.current);
    if (!curve || !fill || typeof curve.getTotalLength !== 'function') return;
    const total = curve.getTotalLength();
    if (!total) return; // the measure effect's retry loop re-renders us
    revealedKey.current = key;
    setRevealDone(false);
    if (reduceMotion) {
      setRevealDone(true);
      return;
    }
    const duration = hasRevealedOnce.current ? RE_REVEAL_DURATION_MS : REVEAL_DURATION_MS;
    hasRevealedOnce.current = true;
    const rect = clipRectRef.current;
    // Place the hidden state without transitions...
    curve.style.transition = 'none';
    curve.style.strokeDasharray = `${total} ${total}`;
    curve.style.strokeDashoffset = `${total}`;
    fill.style.clipPath = `url(#${clipId})`;
    if (rect) {
      rect.style.transition = 'none';
      rect.style.transform = 'scaleX(0)';
    }
    // ...flush it, then transition to drawn.
    curve.getBoundingClientRect();
    curve.style.transition = `stroke-dashoffset ${duration}ms ${REVEAL_EASING}`;
    curve.style.strokeDashoffset = '0';
    if (rect) {
      rect.style.transition = `transform ${duration}ms ${REVEAL_EASING}`;
      rect.style.transform = 'scaleX(1)';
    }
    clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      if (revealedKey.current !== key) return;
      // Leave the paths clean: a resize would reshape them under a stale dash.
      curve.style.transition = '';
      curve.style.strokeDasharray = '';
      curve.style.strokeDashoffset = '';
      fill.style.clipPath = '';
      if (rect) rect.style.transition = '';
      setRevealDone(true);
    }, duration);
  }, [geom, seriesKey, reduceMotion, clipId]);
  useLayoutEffect(() => () => clearTimeout(revealTimer.current), []);

  // The data points act as magnets: the window's TARGET is recharts' snapped
  // tooltip coordinate (the nearest point), so it always comes to rest centred
  // on a data point — with the dot and tooltip. The slow spring is what makes
  // the pull visible: crossing the midpoint to the next point plays the whole
  // travel along the line (~420ms from a standing start), while a far jump
  // covers its distance in the same time, sweeping rather than crawling.
  const hoverX = revealDone && isActive && coordinate && geom ? coordinate.x : null;
  const isHovering = hoverX != null;

  // Dim the whole series layer (stroke + gradient fill) while hovering. The
  // active dot and cursor render outside `g.recharts-area`, so they stay lit.
  useLayoutEffect(() => {
    const { layer } = findSeriesPaths(probeRef.current);
    if (!layer) return;
    layer.style.transition = reduceMotion ? '' : `opacity ${HOVER_CROSSFADE_MS}ms ${HOVER_CROSSFADE_EASE}`;
    layer.style.opacity = isHovering ? `${DIMMED_ALPHA}` : '';
  }, [isHovering, reduceMotion, seriesKey]);

  // Both the piece's length and the pace of its hop scale with the point
  // spacing, so the weekly ranges (a handful of points, ~100px hops) move a
  // longer piece more slowly instead of flicking a sliver across the gap.
  const spacingArc = geom && data.length > 1 ? geom.lut.total / (data.length - 1) : 0;
  const windowLength = segmentLength(spacingArc);

  // The bright segment: dash window centred on the magnet point's arc length.
  const centerLength = hoverX != null && geom ? arcLengthAtX(geom.lut, hoverX) : null;
  const dashoffset = centerLength != null ? windowLength / 2 - centerLength : null;
  // `useDashoffsetFollow` owns `stroke-dashoffset`; it stays out of the style prop.
  const segmentRef = useDashoffsetFollow<SVGPathElement>(dashoffset, tailResponse(spacingArc));

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          {/* scaleX about the plot's left edge wipes the fill with the stroke. */}
          <rect ref={clipRectRef} x={0} y={0} width={width ?? 0} height={height ?? 0} />
        </clipPath>
      </defs>
      <g ref={probeRef} />
      <ZIndexLayer zIndex={DefaultZIndexes.line}>
        {geom && (
          <path
            data-testid="chart-hover-segment"
            d={geom.d}
            ref={segmentRef}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            pointerEvents="none"
            strokeDasharray={`${windowLength} ${geom.lut.total}`}
            style={{
              opacity: isHovering ? 1 : 0,
              transition: reduceMotion ? undefined : `opacity ${HOVER_CROSSFADE_MS}ms ${HOVER_CROSSFADE_EASE}`
            }}
          />
        )}
      </ZIndexLayer>
    </>
  );
}
