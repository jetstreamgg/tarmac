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
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('bg-surface inline-flex items-center gap-0.5 rounded-full px-2 py-1.5', className)}
    >
      {segments.map((color, index) => (
        <span key={index} className={cn('h-1 w-2.5 rounded-full', color ?? 'bg-text/10')} />
      ))}
    </div>
  );
}

const TIERS: EarnRiskTier[] = ['low', 'moderate', 'advanced'];

const TIER_COLOR: Record<EarnRiskTier, string> = {
  low: 'bg-green-400',
  moderate: 'bg-orange-400',
  advanced: 'bg-red-400'
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
