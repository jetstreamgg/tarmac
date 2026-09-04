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
// 5246:24677). Their boundaries are the REAL liquidation-proximity thresholds
// (0 / 25 / 40 / 80%, `RISK_LEVEL_THRESHOLDS`), not even quarters: the fill
// encodes the position's actual proximity, so a Medium position (say 33%)
// has to land inside the zone labelled Medium (APP-545).
const RISK_ZONES = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.LIQUIDATION] as const;

const zoneStart = (level: RiskLevel) =>
  (RISK_LEVEL_THRESHOLDS.find(t => t.level === level)?.threshold ?? 0) / 100;
/** [start, end) of each zone as 0–1 fractions of the bar. */
const RISK_ZONE_BOUNDS: Record<RiskLevel, [number, number]> = {
  [RiskLevel.LOW]: [zoneStart(RiskLevel.LOW), zoneStart(RiskLevel.MEDIUM)],
  [RiskLevel.MEDIUM]: [zoneStart(RiskLevel.MEDIUM), zoneStart(RiskLevel.HIGH)],
  [RiskLevel.HIGH]: [zoneStart(RiskLevel.HIGH), zoneStart(RiskLevel.LIQUIDATION)],
  [RiskLevel.LIQUIDATION]: [zoneStart(RiskLevel.LIQUIDATION), 1]
};

// The fill takes the DS Badges/Risk palette (components/badges/bg-risk-*) so
// the bar and the risk pill beside it name the same level in the same colour
// (APP-545: the pill read Medium in amber over a blue bar). Liquidation is
// the one step past High: the status error red.
const RISK_ZONE_FILL: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-riskLow',
  [RiskLevel.MEDIUM]: 'bg-riskMedium',
  [RiskLevel.HIGH]: 'bg-riskHigh',
  [RiskLevel.LIQUIDATION]: 'bg-statusError'
};

const RISK_ZONE_LABEL: Record<RiskLevel, ReactNode> = {
  [RiskLevel.LOW]: <Trans>Low</Trans>,
  [RiskLevel.MEDIUM]: <Trans>Medium</Trans>,
  [RiskLevel.HIGH]: <Trans>High</Trans>,
  [RiskLevel.LIQUIDATION]: <Trans>Liquidation</Trans>
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * DS "Charts / Progress Steps" (Figma 5246:24677): a value-driven risk bar -
 * a rounded track split into four zones (Low → Liquidation) at the real risk
 * thresholds, with a fill whose length encodes the risk and whose colour is
 * the zone's DS risk colour, dot-markers at the zone boundaries, and a tick at
 * the liquidation threshold. Distinct from the compact table-cell `RiskMeter`
 * pill above.
 *
 * Drive it with a discrete `level` (fills to the end of that zone) or a
 * continuous `value` (0–1 fraction; the colour follows whichever zone the
 * value lands in). Pass both to fill to `value` while tinting by `level`. With
 * neither it renders the empty legend (track + labels). Decorative unless
 * `label` names the state for assistive tech.
 */
export function RiskScaleMeter({
  level,
  value,
  label,
  className
}: {
  level?: RiskLevel;
  value?: number;
  label?: string;
  className?: string;
}) {
  const levelIndex = level ? RISK_ZONES.indexOf(level) : -1;
  const liquidationTick = zoneStart(RiskLevel.LIQUIDATION);

  // Zone/tint prefers an explicit `level`; otherwise the zone the value lands
  // in (thresholds, not quarters). Fill length prefers a continuous `value`;
  // otherwise the level's zone end (Liquidation → the threshold tick - Figma
  // 5246:24677 leaves a tail past it rather than filling the whole bar).
  // Passing both fills to `value` but tints by `level`, e.g. the stake
  // liquidation indicator (real proximity, real risk level).
  const valueZoneIndex =
    value !== undefined ? RISK_ZONES.findIndex(zone => clamp01(value) < RISK_ZONE_BOUNDS[zone][1]) : -1;
  const activeIndex =
    levelIndex >= 0
      ? levelIndex
      : value !== undefined
        ? valueZoneIndex === -1
          ? RISK_ZONES.length - 1 // value === 1 sits past every zone end
          : valueZoneIndex
        : -1;
  const activeZone = activeIndex >= 0 ? RISK_ZONES[activeIndex] : undefined;

  const fillFraction =
    value !== undefined
      ? clamp01(value)
      : level === RiskLevel.LIQUIDATION
        ? liquidationTick
        : level
          ? RISK_ZONE_BOUNDS[level][1]
          : 0;

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('flex w-full flex-col gap-1.5', className)}
    >
      <div className="bg-fgQuaternary/30 relative h-1 w-full rounded-full">
        {activeZone && fillFraction > 0 && (
          <span
            data-testid="risk-scale-fill"
            data-zone={activeZone}
            className={cn('absolute inset-y-0 left-0 rounded-full', RISK_ZONE_FILL[activeZone])}
            style={{ width: `${fillFraction * 100}%` }}
          />
        )}
        {/* Zone boundary markers at the real thresholds (25 / 40 / 80%), drawn
            OVER the fill in the card's own colour so they read as notches on
            the covered stretch too — a Medium position must still show where
            Low ended (APP-545 follow-up). Rendered after the fill for the
            stacking order; the 2px ring lifts them off either surface. */}
        {RISK_ZONES.slice(1).map(zone => (
          <span
            key={zone}
            data-testid="risk-scale-marker"
            className="bg-fgSecondary ring-bgSecondary absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
            style={{ left: `${RISK_ZONE_BOUNDS[zone][0] * 100}%` }}
          />
        ))}
        <span
          className="bg-fgSecondary ring-bgSecondary absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 ring-1"
          style={{ left: `${liquidationTick * 100}%` }}
        />
      </div>
      {/* Each label spans its own zone, so it sits over the stretch of bar it
          names — the Medium label over 25–40%, not over the second quarter. */}
      <div className="flex">
        {RISK_ZONES.map((zone, i) => (
          <span
            key={zone}
            className={cn(
              'text-center text-xs whitespace-nowrap',
              i <= activeIndex ? 'text-fgSecondary' : 'text-fgQuaternary'
            )}
            style={{ width: `${(RISK_ZONE_BOUNDS[zone][1] - RISK_ZONE_BOUNDS[zone][0]) * 100}%` }}
          >
            {RISK_ZONE_LABEL[zone]}
          </span>
        ))}
      </div>
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
