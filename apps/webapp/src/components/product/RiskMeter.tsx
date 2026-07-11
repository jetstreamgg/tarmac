import { cn } from '@/lib/cn';
import type { EarnRiskTier } from '@/hooks';

/**
 * Generic three-dash risk pill — purely presentational (review feedback on
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
  // Figma Badges/Risk (Table Cell Type=Risk): 15px bordered pill of three
  // 8×3 segments; unlit segments are fg-quaternary at 40%.
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'border-glassBorder inline-flex h-[15px] items-center gap-px rounded-full border px-1.5',
        className
      )}
    >
      {segments.map((color, index) => (
        <span key={index} className={cn('h-[3px] w-2 rounded-[2px]', color ?? 'bg-fgQuaternary/40')} />
      ))}
    </div>
  );
}

const TIERS: EarnRiskTier[] = ['low', 'moderate', 'advanced'];

// Figma status palette: Low = fg-success, Medium = fg-warning. A 3-lit tier
// never appears in the Figma patterns — error red pending design confirmation.
const TIER_COLOR: Record<EarnRiskTier, string> = {
  low: 'bg-statusSuccess',
  moderate: 'bg-statusWarning',
  advanced: 'bg-error'
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
