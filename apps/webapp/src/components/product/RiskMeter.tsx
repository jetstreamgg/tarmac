import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { RiskLevel, RISK_LEVEL_THRESHOLDS, type EarnRiskTier } from '@/hooks';

/**
 * Generic three-dash risk pill - purely presentational (review feedback on
 * the F-track PR: one pill, many domains). Callers translate their domain
 * (product risk tier, liquidation proximity, …) into per-segment fill
 * classes; `null` entries render the shared unlit tint. Decorative unless a
 * `label` names the state for assistive tech.
 */
export function RiskMeter({
  segments,
  label,
  className
}: {
  segments: (string | null)[];
  label?: string;
  className?: string;
}) {
  // Figma Badges/Risk (5017:7512): 38×15 bordered pill of three 8×3 segments;
  // unlit segments are fg-quaternary at 40%. Figma insets the segments 6px
  // from the outer edge with the stroke drawn inside the frame, so the CSS
  // padding is that inset minus the 1px border - px-[5px], not px-1.5, which
  // rendered the pill 2px too wide.
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'border-glassBorder inline-flex h-[15px] items-center gap-px rounded-full border px-[5px]',
        className
      )}
    >
      {segments.map((color, index) => (
        <span key={index} className={cn('h-[3px] w-2 rounded-[2px]', color ?? 'bg-fgQuaternary/40')} />
      ))}
    </div>
  );
}

// The four risk zones, ascending across the DS Progress Steps bar (Figma
// 3199:81157): each gets an equal quarter of the bar. The zone boundaries are
// the REAL liquidation-proximity thresholds (0 / 25 / 40 / 80%,
// `RISK_LEVEL_THRESHOLDS`), so a value is mapped piecewise onto the quarters:
// a Medium position (say 33%) still lands inside the quarter labelled Medium
// (APP-545).
const RISK_ZONES = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.LIQUIDATION] as const;

const zoneStart = (level: RiskLevel) =>
  (RISK_LEVEL_THRESHOLDS.find(t => t.level === level)?.threshold ?? 0) / 100;
/** [start, end) of each zone as 0–1 proximity fractions: each starts at its threshold and ends at the next zone's. */
const RISK_ZONE_BOUNDS = Object.fromEntries(
  RISK_ZONES.map((zone, i) => [
    zone,
    [zoneStart(zone), i + 1 < RISK_ZONES.length ? zoneStart(RISK_ZONES[i + 1]) : 1]
  ])
) as Record<RiskLevel, [number, number]>;

const QUARTER = 1 / RISK_ZONES.length;

// The fill is the DS gradient-slider of the zone (Progress Steps 3199:81157:
// green for Low, yellow for Medium, red for High and Liquidation), so the bar
// reads like the borrow slider beside it (Design QA 3324:143419).
export const RISK_ZONE_FILL: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'from-slider-green-start to-slider-green-end',
  [RiskLevel.MEDIUM]: 'from-slider-yellow-start to-slider-yellow-end',
  [RiskLevel.HIGH]: 'from-slider-red-start to-slider-red-end',
  [RiskLevel.LIQUIDATION]: 'from-slider-red-start to-slider-red-end'
};

const RISK_ZONE_LABEL: Record<RiskLevel, ReactNode> = {
  [RiskLevel.LOW]: <Trans>Low</Trans>,
  [RiskLevel.MEDIUM]: <Trans>Medium</Trans>,
  [RiskLevel.HIGH]: <Trans>High</Trans>,
  [RiskLevel.LIQUIDATION]: <Trans>Liquidation</Trans>
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// The last zone whose start the value has reached (LOW starts at 0, so a
// value always lands somewhere).
const valueZoneIndex = (v: number) =>
  RISK_ZONES.filter(zone => clamp01(v) >= RISK_ZONE_BOUNDS[zone][0]).length - 1;

/** Proximity fraction → position on the equal-quarter bar. */
const toBarFraction = (v: number) => {
  const index = valueZoneIndex(v);
  const [start, end] = RISK_ZONE_BOUNDS[RISK_ZONES[index]];
  return (index + (clamp01(v) - start) / (end - start)) * QUARTER;
};

/**
 * DS "Charts / Progress Steps" (Figma 3199:81157): a value-driven risk bar -
 * a rounded track split into four equal zones (Low → Liquidation), with a
 * fill whose length encodes the risk and whose gradient is the zone's slider
 * colour, a faint 2px dot centred in each zone and a tick where Liquidation
 * starts. Distinct from the compact table-cell `RiskMeter` pill above.
 *
 * Drive it with a discrete `level` (fills to the end of that zone) or a
 * continuous `value` (0–1 liquidation proximity; the colour follows whichever
 * zone the value lands in). Pass both to fill to `value` while tinting by
 * `level`. With neither it renders the empty legend (track + labels).
 * `showLabels={false}` drops the zone labels (summary card, comp 3617:24493).
 * Decorative unless `label` names the state for assistive tech.
 */
export function RiskScaleMeter({
  level,
  value,
  label,
  showLabels = true,
  className
}: {
  level?: RiskLevel;
  value?: number;
  label?: string;
  showLabels?: boolean;
  className?: string;
}) {
  const levelIndex = level ? RISK_ZONES.indexOf(level) : -1;

  // Zone/tint prefers an explicit `level`; otherwise the zone the value lands
  // in. Fill length prefers a continuous `value`; otherwise the level's zone
  // end — Liquidation to the end of the bar, so it stays distinguishable from
  // High (whose zone ends where Liquidation's starts).
  const activeIndex = levelIndex >= 0 ? levelIndex : value !== undefined ? valueZoneIndex(value) : -1;
  const activeZone = activeIndex >= 0 ? RISK_ZONES[activeIndex] : undefined;
  const fillFraction = value !== undefined ? toBarFraction(value) : level ? (levelIndex + 1) * QUARTER : 0;

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('flex w-full flex-col gap-1.5', className)}
    >
      <div className="bg-sliderTrack relative h-1 w-full rounded-full">
        {/* Design QA 3324:143419 "Dots styling": the DS bar draws no boundary
            markers, only a 2px dot in the track's own tint centred in each
            zone (under its label) and a 2×14 fg-line tick where Liquidation
            starts. The dots come first in the DOM so the fill covers them;
            the tick draws over both. */}
        {RISK_ZONES.map((zone, i) => (
          <span
            key={zone}
            data-testid="risk-scale-dot"
            className="bg-sliderTrack absolute top-1/2 size-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${(i + 0.5) * QUARTER * 100}%` }}
          />
        ))}
        {activeZone && fillFraction > 0 && (
          <span
            data-testid="risk-scale-fill"
            data-zone={activeZone}
            className={cn(
              'absolute inset-y-0 left-0 rounded-full bg-linear-to-r',
              RISK_ZONE_FILL[activeZone]
            )}
            style={{ width: `${fillFraction * 100}%` }}
          />
        )}
        <span
          data-testid="risk-scale-liquidation-tick"
          className="bg-sliderLine absolute -inset-y-[5px] w-0.5 -translate-x-1/2"
          style={{ left: `${(RISK_ZONES.length - 1) * QUARTER * 100}%` }}
        />
      </div>
      {showLabels && (
        <div className="flex">
          {RISK_ZONES.map(zone => (
            <span
              key={zone}
              // Only the Liquidation label is dimmed (fg-tertiary) in the DS
              // comp; the others stay fg-secondary whatever the fill reaches.
              className={cn(
                'min-w-0 flex-1 text-center text-xs leading-[18px] whitespace-nowrap',
                zone === RiskLevel.LIQUIDATION ? 'text-fgTertiary' : 'text-fgSecondary'
              )}
            >
              {RISK_ZONE_LABEL[zone]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const TIERS: EarnRiskTier[] = ['low', 'moderate', 'advanced'];

// Figma Badges/Risk palette (5017:7512): the DS gave the risk pill its own
// components/badges/bg-risk-* variables rather than reusing components/status,
// so Advanced is orange (Orange/600) - not the status red the meter borrowed
// before - and Core/Medium take different light-mode steps than
// fg-success/fg-warning do.
const TIER_COLOR: Record<EarnRiskTier, string> = {
  low: 'bg-riskLow',
  moderate: 'bg-riskMedium',
  advanced: 'bg-riskHigh'
};

/** Compact product-risk indicator (Figma "Risk profile" cell): N segments lit in the tier color. */
export function RiskTierMeter({ tier, className }: { tier: EarnRiskTier; className?: string }) {
  const filled = TIERS.indexOf(tier) + 1;
  return (
    <RiskMeter
      label={tier}
      className={className}
      segments={TIERS.map((_, index) => (index < filled ? TIER_COLOR[tier] : null))}
    />
  );
}
