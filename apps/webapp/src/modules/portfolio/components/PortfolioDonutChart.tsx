import { ReactNode, useMemo } from 'react';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Pie, PieChart, Sector } from 'recharts';
import type { PieSectorShapeProps } from 'recharts';

export type DonutSegment = {
  id: string;
  /** Any CSS color (hex / token); resolved by the caller. */
  color: string;
  /** Hovered-arc color (DS Components/Charts-Hover); falls back to `color`. */
  hoverColor?: string;
  /** Raw magnitude; normalized to angles internally. */
  value: number;
};

type PortfolioDonutChartProps = {
  /** Keep this array referentially stable across hover renders — a new
   * identity restarts the fill sweep. */
  segments: DonutSegment[];
  /** Shared with the legend/token cluster so hover stays in sync. */
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  /** Rendered centered in the hole for the active segment (e.g. its token icon). */
  renderCenter?: (activeId: string) => ReactNode;
  size?: number;
  className?: string;
};

// Radial dimensions are tuned against the DS Charts / Pie Chart comp (Figma
// 5034:22030, a 178 box measured from its exported vectors: 89 outer radius,
// 8px band, hairline ring at ~72.3) and scale with `size` so the band keeps
// its ~4.5%-of-diameter share at the mobile 160.
const BASE_SIZE = 178;
const PAD = 0; // the band touches the box edge in the comp
const THICKNESS = 8; // colored band width
const PADDING_ANGLE = 3; // gap between segments, degrees — angular, so unscaled
const RING_GAP = 9; // distance from the colored band's inner edge to the gray ring
const RING_STROKE = 1.5; // hairline at every size
const CORNER_RADIUS = 4; // = THICKNESS / 2 — fully rounded bar ends per the comp
const START_ANGLE = 90; // 12 o'clock
const END_ANGLE = -270; // full sweep, clockwise
const FULL_CIRCLE_EPS = 359.9;

// Motion (Figma 2233:61099). The arcs fill in clockwise from 12 o'clock once
// the data is in — recharts' own sweep, timed to land with the rest of the
// card's entrance; the hairline ring fades up underneath it. Hovering swaps
// the hovered arc to its hover color and dims the others to 50%, both on a
// 350ms ease-out; the centre label rises 6px into the hole on the same clock
// and leaves upward when the hover ends.
const FILL_BEGIN_MS = 300;
const FILL_DURATION_MS = 900;
const HOVER_MS = 350;
const HOVER_EASE = 'ease-out';
const CENTER_IN = { y: 6, opacity: 0 };
const CENTER_OUT = { y: -10, opacity: 0 };

type Sector = { id: string; startAngle: number; endAngle: number };

// Polar → cartesian with SVG's y-down axis (math angle, CCW-positive).
const polar = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos((deg * Math.PI) / 180),
  y: cy - r * Math.sin((deg * Math.PI) / 180)
});

// Arc from startDeg to endDeg sweeping clockwise on screen (decreasing angle).
const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = startDeg - endDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

// Replicates recharts' Pie sector angles (full circle, clockwise) so the inner
// ring and active highlight line up exactly with the colored bars: full circle
// inserts one padding gap per segment, the rest is split by value.
const computeSectors = (segments: DonutSegment[]): Sector[] => {
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  if (sum <= 0) return [];
  const padding = segments.length <= 1 ? 0 : PADDING_ANGLE;
  const realTotal = 360 - segments.length * padding;
  let cursor = START_ANGLE;
  return segments.map(segment => {
    const sweep = (segment.value / sum) * realTotal;
    const startAngle = cursor;
    const endAngle = cursor - sweep;
    cursor = endAngle - padding;
    return { id: segment.id, startAngle, endAngle };
  });
};

const ringClass = (isActive: boolean) => (isActive ? 'stroke-text/30' : 'stroke-text/10');

/**
 * Donut of supplied positions. The colored arcs are recharts sectors (rounded
 * ends + gaps); the thin inner ring mirrors those sectors as hand-rolled SVG
 * arcs sharing the exact same center and angles, so the ring and the active
 * highlight stay locked to the bars. Stateless: the caller owns `activeId`.
 */
export function PortfolioDonutChart({
  segments,
  activeId,
  onActiveChange,
  renderCenter,
  size = BASE_SIZE,
  className
}: PortfolioDonutChartProps) {
  const prefersReducedMotion = useReducedMotion();
  // Keyed on `segments` identity: recharts re-runs the sweep whenever its
  // `data` changes, so callers must hand in a stable array (memoised on their
  // source data, not rebuilt per hover render).
  const chartSegments = useMemo(() => segments.filter(s => s.value > 0), [segments]);
  const sectors = computeSectors(chartSegments);
  const isEmpty = chartSegments.length === 0;

  const scale = size / BASE_SIZE;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - PAD * scale;
  const innerRadius = outerRadius - THICKNESS * scale;
  const ringRadius = innerRadius - RING_GAP * scale;
  const isSingle = chartSegments.length === 1;
  const singleFullRing =
    sectors.length === 1 && Math.abs(sectors[0].startAngle - sectors[0].endAngle) >= FULL_CIRCLE_EPS;

  return (
    <div
      className={className}
      style={{ position: 'relative', width: size, height: size }}
      onMouseLeave={() => onActiveChange(null)}
      data-testid="portfolio-donut"
    >
      {chartSegments.length > 0 && (
        <div className="absolute inset-0">
          <PieChart width={size} height={size} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={chartSegments}
              dataKey="value"
              nameKey="id"
              cx={cx}
              cy={cy}
              startAngle={START_ANGLE}
              endAngle={END_ANGLE}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={isSingle ? 0 : PADDING_ANGLE}
              cornerRadius={isSingle ? 0 : CORNER_RADIUS * scale}
              stroke="none"
              isAnimationActive={!prefersReducedMotion}
              animationBegin={FILL_BEGIN_MS}
              animationDuration={FILL_DURATION_MS}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => onActiveChange(chartSegments[index]?.id ?? null)}
              // `Cell` is deprecated (removed in recharts 4); per-sector fill +
              // hover dimming via the `shape` prop, rendering the same Sector.
              // DS pie hover (Figma 5051:133511): the hovered arc swaps to its
              // Charts-Hover color; the others dim to 50%.
              shape={(props: PieSectorShapeProps) => {
                const segment = props.payload as DonutSegment;
                const isActive = activeId === segment.id;
                const dim = activeId !== null && !isActive;
                return (
                  <Sector
                    {...props}
                    fill={isActive ? (segment.hoverColor ?? segment.color) : segment.color}
                    fillOpacity={dim ? 0.5 : 1}
                    style={{
                      transition: `fill-opacity ${HOVER_MS}ms ${HOVER_EASE}, fill ${HOVER_MS}ms ${HOVER_EASE}`,
                      outline: 'none'
                    }}
                  />
                );
              }}
            />
          </PieChart>
        </div>
      )}

      {/* Inner ring: mirrors the sectors (gaps + active highlight) or a plain
          full circle when there are 0 or 1 segments. The empty state renders a
          muted ring + "No tokens" label per the DS Pie (Figma 5051:133511). */}
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0"
        initial={prefersReducedMotion || isEmpty ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: FILL_DURATION_MS / 1000, delay: FILL_BEGIN_MS / 1000, ease: 'easeOut' }}
      >
        {/* Empty case (Figma 5272:12915): the colored band is replaced by an
            unbroken tinted band at the same radius, so the chart keeps its
            footprint instead of collapsing to a lone hairline. Both it and the
            hairline sit on border-secondary. */}
        {isEmpty && (
          <circle
            data-testid="donut-empty-band"
            cx={cx}
            cy={cy}
            r={outerRadius - (THICKNESS * scale) / 2}
            fill="none"
            strokeWidth={THICKNESS * scale}
            className="stroke-glassBorder"
          />
        )}
        {sectors.length === 0 || singleFullRing ? (
          <circle
            data-testid="donut-ring"
            cx={cx}
            cy={cy}
            r={ringRadius}
            fill="none"
            strokeWidth={RING_STROKE}
            className={
              isEmpty ? 'stroke-glassBorder' : ringClass(singleFullRing && activeId === sectors[0]?.id)
            }
          />
        ) : (
          sectors.map(sector => (
            <path
              key={sector.id}
              d={arcPath(cx, cy, ringRadius, sector.startAngle, sector.endAngle)}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              className={ringClass(activeId === sector.id)}
            />
          ))
        )}
      </motion.svg>

      {/* Active-segment token, centered in the hole. Keyed per segment so a
          hover that moves straight from one arc to the next rolls the label
          over (old up and out, new up and in) instead of swapping it. */}
      {renderCenter && (
        <div className="pointer-events-none absolute inset-0">
          <AnimatePresence initial={false}>
            {activeId && (
              <motion.div
                key={activeId}
                className="absolute inset-0 flex items-center justify-center"
                initial={prefersReducedMotion ? false : CENTER_IN}
                animate={{ y: 0, opacity: 1 }}
                exit={prefersReducedMotion ? undefined : CENTER_OUT}
                transition={{ duration: prefersReducedMotion ? 0 : HOVER_MS / 1000, ease: 'easeOut' }}
              >
                {renderCenter(activeId)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Label 4 on fg-primary per the empty comp — the old fgSecondary/sm pair
          read as a disabled chart rather than a deliberate empty state. */}
      {isEmpty && (
        <div className="text-fgPrimary font-circle pointer-events-none absolute inset-0 flex items-center justify-center text-base leading-[18px] font-medium tracking-[-0.32px]">
          <Trans>No tokens</Trans>
        </div>
      )}
    </div>
  );
}
