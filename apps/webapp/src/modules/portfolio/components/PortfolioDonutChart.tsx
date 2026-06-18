import { ReactNode } from 'react';
import { Pie, PieChart, Sector } from 'recharts';
import type { PieSectorShapeProps } from 'recharts';

export type DonutSegment = {
  id: string;
  /** Any CSS color (hex / token); resolved by the caller. */
  color: string;
  /** Raw magnitude; normalized to angles internally. */
  value: number;
};

type PortfolioDonutChartProps = {
  segments: DonutSegment[];
  /** Shared with the legend/token cluster so hover stays in sync. */
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  /** Rendered centered in the hole for the active segment (e.g. its token icon). */
  renderCenter?: (activeId: string) => ReactNode;
  size?: number;
  className?: string;
};

const PAD = 4; // breathing room from the box edge
const THICKNESS = 18; // colored band width
const PADDING_ANGLE = 3; // gap between segments, degrees
const RING_GAP = 10; // distance from the colored band's inner edge to the gray ring
const RING_STROKE = 1.5;
const CORNER_RADIUS = 4; // subtle rounding on the bar ends
const START_ANGLE = 90; // 12 o'clock
const END_ANGLE = -270; // full sweep, clockwise
const FULL_CIRCLE_EPS = 359.9;

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
  size = 320,
  className
}: PortfolioDonutChartProps) {
  const chartSegments = segments.filter(s => s.value > 0);
  const sectors = computeSectors(chartSegments);

  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - PAD;
  const innerRadius = outerRadius - THICKNESS;
  const ringRadius = innerRadius - RING_GAP;
  const isSingle = chartSegments.length === 1;
  const singleFullRing =
    sectors.length === 1 && Math.abs(sectors[0].startAngle - sectors[0].endAngle) >= FULL_CIRCLE_EPS;

  return (
    <div
      className={className}
      style={{ position: 'relative', width: size, height: size }}
      onMouseLeave={() => onActiveChange(null)}
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
              cornerRadius={isSingle ? 0 : CORNER_RADIUS}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_, index) => onActiveChange(chartSegments[index]?.id ?? null)}
              // `Cell` is deprecated (removed in recharts 4); per-sector fill +
              // hover dimming via the `shape` prop, rendering the same Sector.
              shape={(props: PieSectorShapeProps) => {
                const segment = props.payload as DonutSegment;
                const dim = activeId !== null && activeId !== segment.id;
                return (
                  <Sector
                    {...props}
                    fill={segment.color}
                    fillOpacity={dim ? 0.5 : 1}
                    style={{ transition: 'fill-opacity 150ms ease-out', outline: 'none' }}
                  />
                );
              }}
            />
          </PieChart>
        </div>
      )}

      {/* Inner ring: mirrors the sectors (gaps + active highlight) or a plain
          full circle when there are 0 or 1 segments. */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0"
      >
        {sectors.length === 0 || singleFullRing ? (
          <circle
            cx={cx}
            cy={cy}
            r={ringRadius}
            fill="none"
            strokeWidth={RING_STROKE}
            className={ringClass(singleFullRing && activeId === sectors[0]?.id)}
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
      </svg>

      {/* Active-segment token, centered in the hole. */}
      {activeId && renderCenter && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {renderCenter(activeId)}
        </div>
      )}
    </div>
  );
}
