import type { MouseEvent, ReactNode } from 'react';
import { BadgeCheck, MoveUpRight, X } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex, type EarnProductKind, type EarnRiskTier } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  ResponsiveModalTrigger
} from '@/components/ui/responsive-modal';
import { RiskTierMeter } from './RiskMeter';

// TODO(BL-07): like the tier assignment in hooks/earn/earnProducts.ts, this
// per-tier copy is a static front-end config pending the risk-rating source
// decision — the comp treats it as editorial content, not product data.
export const RISK_LEARN_MORE_URL = 'https://docs.sky.money';

/**
 * The severity presentation per tier (1036:201215): display name + scale.
 * The comp frame reads "Aggresive" — corrected spelling here.
 */
const RISK_TIER_DETAILS: Record<
  EarnRiskTier,
  { title: ReactNode; litSegments: number; segmentClass: string }
> = {
  low: { title: <Trans>Conservative</Trans>, litSegments: 1, segmentClass: 'bg-statusSuccessSolid' },
  moderate: { title: <Trans>Moderate</Trans>, litSegments: 2, segmentClass: 'bg-statusWarning' },
  advanced: { title: <Trans>Aggressive</Trans>, litSegments: 3, segmentClass: 'bg-error' }
};

/**
 * The explanatory copy per product family. The comp writes one blurb per tier,
 * but each was clearly authored for the single product family occupying that
 * tier (Conservative → Savings, Moderate → Morpho vaults, Aggressive →
 * stUSDS) — reusing the Morpho blurb on a Pendle market would be wrong, so
 * the copy keys off the product kind while the tier keeps the severity
 * presentation. The savings/vault/stusds texts are verbatim from 1036:201215;
 * the rewards/fixed texts are PLACEHOLDER copy in the same voice, pending
 * product sign-off (flagged on APP-396).
 */
const RISK_KIND_DETAILS: Record<
  EarnProductKind,
  { description: ReactNode; liquidationRisk: ReactNode; withdrawals: ReactNode }
> = {
  savings: {
    description: (
      <Trans>
        Funds secured directly by Sky Protocol. A fixed rate determined by governance, with instant liquidity.
      </Trans>
    ),
    liquidationRisk: <Trans>None</Trans>,
    withdrawals: <Trans>Instant</Trans>
  },
  rewards: {
    // Deliberately reward-agnostic: most Rewards contracts pay a second token,
    // but Chronicle Points pays points — don't promise a token here.
    description: (
      <Trans>Supply directly to Sky Protocol and earn rewards. Reward rates vary with emissions.</Trans>
    ),
    liquidationRisk: <Trans>None</Trans>,
    withdrawals: <Trans>Instant</Trans>
  },
  vault: {
    description: (
      <Trans>Third-party strategies deployed by Morpho. Returns vary depending on market utilization.</Trans>
    ),
    liquidationRisk: <Trans>None</Trans>,
    withdrawals: <Trans>Active management</Trans>
  },
  fixed: {
    description: (
      <Trans>
        Fixed-yield markets powered by Pendle. The rate is locked when you enter and realized at market
        maturity.
      </Trans>
    ),
    liquidationRisk: <Trans>None</Trans>,
    withdrawals: <Trans>At maturity</Trans>
  },
  stusds: {
    description: (
      <Trans>
        For advanced users. Higher yield with utilization-dependent variable returns and liquidation risk on
        staked positions.
      </Trans>
    ),
    liquidationRisk: <Trans>Yes</Trans>,
    withdrawals: <Trans>Yes</Trans>
  }
};

function FactRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex w-full items-center justify-between">
      <span className="font-graphik text-fgSecondary text-[11px] leading-4">{label}</span>
      <span className="font-circle text-fgPrimary flex items-center gap-1 text-xs leading-3.5 font-medium tracking-[-0.24px]">
        {value}
      </span>
    </div>
  );
}

/** Scale + description + divider + fact rows — shared by the tooltip card and the bottom sheet. */
function RiskTierDetailsBody({ tier, kind }: { tier: EarnRiskTier; kind: EarnProductKind }) {
  const severity = RISK_TIER_DETAILS[tier];
  const details = RISK_KIND_DETAILS[kind];

  return (
    <>
      <div className="flex w-full items-center gap-[3px]" data-testid="risk-details-scale">
        {[0, 1, 2].map(index => (
          <span
            key={index}
            data-testid="risk-details-segment"
            className={cn(
              'h-1 flex-1 rounded-full',
              index < severity.litSegments ? severity.segmentClass : 'bg-bgTertiary'
            )}
          />
        ))}
      </div>
      <p className="font-graphik text-fgSecondary text-[11px] leading-4">{details.description}</p>
      <div className="border-borderPrimary w-full border-b" />
      <div className="flex w-full flex-col gap-1.5">
        <FactRow
          label={<Trans>Smart contract</Trans>}
          value={
            <>
              <BadgeCheck size={12} className="text-statusSuccess" aria-hidden />
              <Trans>Audited</Trans>
            </>
          }
        />
        <FactRow label={<Trans>Liquidation risk</Trans>} value={details.liquidationRisk} />
        <FactRow label={<Trans>Withdrawals</Trans>} value={details.withdrawals} />
      </div>
    </>
  );
}

/**
 * Per-tier risk profile details (Figma Risk profile tooltip 1036:201215):
 * eyebrow + tier title, tier-colored 3-step scale, editorial description and
 * the Smart contract / Liquidation risk / Withdrawals facts, closed by a
 * "Learn more about risk" external link. Pure content — the host surface
 * (tooltip on md+, bottom sheet below) supplies chrome and behavior.
 */
export function RiskTierDetailsCard({
  tier,
  kind,
  className
}: {
  tier: EarnRiskTier;
  kind: EarnProductKind;
  className?: string;
}) {
  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-px">
        <span className="font-graphik text-fgSecondary text-xs leading-[18px]">
          <Trans>Risk profile</Trans>
        </span>
        <span className="font-circle text-fgPrimary text-base leading-[18px] font-medium tracking-[-0.32px]">
          {RISK_TIER_DETAILS[tier].title}
        </span>
      </div>
      <RiskTierDetailsBody tier={tier} kind={kind} />
      <div className="border-borderPrimary w-full border-b" />
      <a
        href={RISK_LEARN_MORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-circle text-fgPrimary flex w-full items-center justify-between text-xs leading-3.5 font-medium tracking-[-0.24px]"
      >
        <Trans>Learn more about risk</Trans>
        <MoveUpRight size={12} aria-hidden />
      </a>
    </div>
  );
}

/**
 * The interactive risk affordance (APP-396): the tier pill opens the details
 * as a hover/focus tooltip from md up (486:22270 — Radix also force-closes
 * tooltips on touch devices) and as a tap-open bottom sheet below md
 * (486:21797). Clicks never bubble — the pill lives inside clickable
 * table rows and accordion cards.
 */
export function RiskTierDetailsTrigger({
  tier,
  kind,
  className
}: {
  tier: EarnRiskTier;
  kind: EarnProductKind;
  className?: string;
}) {
  const { bpi } = useBreakpointIndex();
  const { t } = useLingui();

  const stopRowClick = (event: MouseEvent) => event.stopPropagation();
  const pill = (
    <RiskTierMeter
      tier={tier}
      // Hover chrome per the comp's Badges/Risk Hover variant.
      className="hover:bg-bgSecondary hover:border-borderTertiary transition-colors"
    />
  );
  const triggerClassName = cn(
    'focus-visible:ring-ring inline-flex rounded-full focus-visible:ring-1 focus-visible:outline-hidden',
    className
  );

  if (bpi < BP.md) {
    return (
      <ResponsiveModal>
        <ResponsiveModalTrigger asChild>
          <button
            type="button"
            aria-label={t`Risk profile`}
            onClick={stopRowClick}
            className={triggerClassName}
          >
            {pill}
          </button>
        </ResponsiveModalTrigger>
        <ResponsiveModalContent
          aria-describedby={undefined}
          onClick={stopRowClick}
          // bg-background (the SheetContent default) is undefined in the dark
          // scope — every sheet consumer supplies its surface (M4.2 pattern).
          className="bg-containerDark backdrop-blur-[50px]"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-px">
                <span className="font-graphik text-fgSecondary text-xs leading-[18px]">
                  <Trans>Risk profile</Trans>
                </span>
                <ResponsiveModalTitle className="font-circle text-fgPrimary text-lg leading-[22px] font-medium tracking-[-0.36px]">
                  {RISK_TIER_DETAILS[tier].title}
                </ResponsiveModalTitle>
              </div>
              <ResponsiveModalClose asChild>
                <Button
                  variant="secondary"
                  size="s"
                  aria-label={t`Close`}
                  className="size-10 rounded-full p-0"
                >
                  <X size={16} aria-hidden />
                </Button>
              </ResponsiveModalClose>
            </div>
            <RiskTierDetailsBody tier={tier} kind={kind} />
            <Button variant="secondary" size="m" className="mt-1 w-full" asChild>
              <a href={RISK_LEARN_MORE_URL} target="_blank" rel="noopener noreferrer">
                <Trans>Learn more about risk</Trans>
                <MoveUpRight size={12} aria-hidden />
              </a>
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t`Risk profile`}
          onClick={stopRowClick}
          className={triggerClassName}
        >
          {pill}
        </button>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent onClick={stopRowClick}>
          <RiskTierDetailsCard tier={tier} kind={kind} className="w-[228px]" />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
