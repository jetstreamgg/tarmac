import { cn } from '@/lib/cn';
import type { EarnRiskTier } from '@/hooks';

const SEGMENTS: EarnRiskTier[] = ['low', 'moderate', 'advanced'];

const TIER_COLOR: Record<EarnRiskTier, string> = {
  low: 'bg-green-400',
  moderate: 'bg-teal-400',
  advanced: 'bg-orange-400'
};

/** Compact three-segment risk indicator (Figma "Risk profile" cell). */
export function RiskMeter({ tier, className }: { tier: EarnRiskTier; className?: string }) {
  const filled = SEGMENTS.indexOf(tier) + 1;
  return (
    <div
      role="img"
      aria-label={tier}
      className={cn('bg-surface inline-flex items-center gap-0.5 rounded-full px-2 py-1.5', className)}
    >
      {SEGMENTS.map((segment, index) => (
        <span
          key={segment}
          className={cn('h-1 w-2.5 rounded-full', index < filled ? TIER_COLOR[tier] : 'bg-text/10')}
        />
      ))}
    </div>
  );
}
