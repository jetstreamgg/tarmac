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

// The four risk zones, ascending and evenly spaced across the DS Progress
// Steps bar (Figma 5246:24677), each with its own 2-stop fill gradient.
const RISK_ZONES = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.LIQUIDATION] as const;

const RISK_ZONE_GRADIENT: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'linear-gradient(90deg, #015C4C 0%, #02C2A1 100%)',
  [RiskLevel.MEDIUM]: 'linear-gradient(90deg, #1B71F5 0%, #59B1FF 100%)',
  [RiskLevel.HIGH]: 'linear-gradient(90deg, #FF8A5C 0%, #FFC738 100%)',
  [RiskLevel.LIQUIDATION]: 'linear-gradient(90deg, #F98607 0%, #F83C3B 100%)'
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
 * a rounded track split into four evenly-spaced zones (Low → Liquidation),
 * with a gradient fill whose length encodes the risk, zone dot-markers, and a
 * tick at the liquidation threshold. Distinct from the compact table-cell
 * `RiskMeter` pill above.
 *
 * Drive it with a discrete `level` (fills to the end of that zone) or a
 * continuous `value` (0–1 fraction; the gradient follows whichever zone the
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
  const zoneCount = RISK_ZONES.length;
  const levelIndex = level ? RISK_ZONES.indexOf(level) : -1;

  // The liquidation threshold sits inside the last visual quarter, so the tick
  // marks its real position rather than the zone boundary.
  const liquidationTick =
    (RISK_LEVEL_THRESHOLDS.find(t => t.level === RiskLevel.LIQUIDATION)?.threshold ?? 80) / 100;

  // Zone/tint prefers an explicit `level`; otherwise the value's quarter. Fill
  // length prefers a continuous `value`; otherwise the level's zone end
  // (Liquidation → the real threshold tick - Figma 5246:24677 leaves a tail past
  // it rather than filling the whole bar). Passing both fills to `value` but
  // tints by `level`, e.g. the stake liquidation indicator (real proximity, real
  // risk level, whose thresholds aren't evenly spaced).
  const activeIndex =
    levelIndex >= 0
      ? levelIndex
      : value !== undefined
        ? Math.min(zoneCount - 1, Math.floor(clamp01(value) * zoneCount))
        : -1;
  const activeZone = activeIndex >= 0 ? RISK_ZONES[activeIndex] : undefined;

  const fillFraction =
    value !== undefined
      ? clamp01(value)
      : level === RiskLevel.LIQUIDATION
        ? liquidationTick
        : levelIndex >= 0
          ? (levelIndex + 1) / zoneCount
          : 0;

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('flex w-full flex-col gap-1.5', className)}
    >
      <div className="bg-fgQuaternary/30 relative h-1 w-full rounded-full">
        {[1, 2, 3].map(i => (
          <span
            key={i}
            className="bg-fgQuaternary/60 absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${(i / zoneCount) * 100}%` }}
          />
        ))}
        <span
          className="bg-fgQuaternary absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${liquidationTick * 100}%` }}
        />
        {activeZone && fillFraction > 0 && (
          <span
            data-testid="risk-scale-fill"
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${fillFraction * 100}%`, backgroundImage: RISK_ZONE_GRADIENT[activeZone] }}
          />
        )}
      </div>
      <div className="flex">
        {RISK_ZONES.map((zone, i) => (
          <span
            key={zone}
            className={cn(
              'flex-1 text-center text-xs',
              i <= activeIndex ? 'text-fgSecondary' : 'text-fgQuaternary'
            )}
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
