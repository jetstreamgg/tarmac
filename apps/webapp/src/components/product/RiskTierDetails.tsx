import type { MouseEvent, ReactNode } from 'react';
import { MoveUpRight, X } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import {
  BP,
  RISK_TIER_BY_PROFILE,
  useBreakpointIndex,
  type EarnRiskProfileId,
  type EarnRiskTier
} from '@/hooks';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  ResponsiveModalTrigger
} from '@/components/ui/responsive-modal';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { RiskTierMeter } from './RiskMeter';
import { withdrawalWording } from './withdrawalAvailability';

// TODO(BL-07): like the tier assignment in hooks/earn/earnProducts.ts, this
// per-tier copy is a static front-end config pending the risk-rating source
// decision — the comp treats it as editorial content, not product data.
export const RISK_LEARN_MORE_URL = 'https://docs.sky.money/user-risks';

/**
 * The severity presentation per tier (1036:201215): display name + scale.
 * The comp frame reads "Aggresive" — corrected spelling here.
 */
const RISK_TIER_DETAILS: Record<
  EarnRiskTier,
  { title: ReactNode; litSegments: number; segmentClass: string }
> = {
  low: { title: <Trans>Conservative</Trans>, litSegments: 1, segmentClass: 'bg-riskLow' },
  moderate: { title: <Trans>Moderate</Trans>, litSegments: 2, segmentClass: 'bg-riskMedium' },
  advanced: { title: <Trans>Aggressive</Trans>, litSegments: 3, segmentClass: 'bg-riskHigh' }
};

/**
 * The explanatory copy + facts per risk profile, from the risk sheet Kacper
 * posted on APP-396 (initial draft, 2026-07-20). Per that comment the
 * "Smart contract: Audited" fact is replaced by "Exposure" — Audited would be
 * true of every product, so it carried no signal. Descriptions are verbatim
 * from the sheet except:
 * - 'rewards-sky' extrapolates the sheet's SPK/GROVE farm pattern (the SKY
 *   farm has no sheet row);
 * - 'rewards' is the generic fallback for reward tokens with no profile yet
 *   (deliberately reward-agnostic — points farms don't pay a second token);
 * - 'vault-tether-savings' (flag-gated sUSDT, absent from the sheet) is
 *   PLACEHOLDER copy pending a product assessment.
 */
const RISK_PROFILE_DETAILS: Record<
  EarnRiskProfileId,
  { description: ReactNode; exposureTokens: string[]; liquidationRisk: ReactNode }
> = {
  savings: {
    description: (
      <Trans>
        Funds secured by Sky Protocol, with instant liquidity and zero fees on access and exit. The Sky
        Savings Rate is determined by governance through a DAO vote.
      </Trans>
    ),
    exposureTokens: ['USDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  rewards: {
    description: (
      <Trans>Supply directly to Sky Protocol to receive rewards. Reward rates vary with emissions.</Trans>
    ),
    exposureTokens: ['USDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  'rewards-sky': {
    description: (
      <Trans>
        Supply to Sky Protocol to receive SKY tokens. The reward rate is set by Sky Protocol governance and
        distributed proportionally to the supplied USDS.
      </Trans>
    ),
    exposureTokens: ['USDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  'rewards-spk': {
    description: (
      <Trans>
        Supply to Sky Protocol and earn SPK tokens. The reward rate is set by Sky Protocol governance and
        distributed proportionally to the supplied USDS.
      </Trans>
    ),
    exposureTokens: ['USDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  'rewards-grove': {
    description: (
      <Trans>
        Supply to Sky Protocol and earn GROVE tokens. The reward rate is set by Sky Protocol governance and
        distributed proportionally to the supplied USDS.
      </Trans>
    ),
    exposureTokens: ['USDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  'rewards-cle': {
    description: (
      <Trans>
        Supply to Sky Protocol and earn Chronicle Points. Point distribution and related opportunities are
        managed by Chronicle.
      </Trans>
    ),
    exposureTokens: ['USDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  'vault-flagship': {
    description: (
      <Trans>
        Vault deployed on Morpho, with a conservative allocation and around 80% of liquidity available for
        instant withdrawal.
      </Trans>
    ),
    exposureTokens: ['cbBTC', 'wstETH', 'WETH', 'PT-sUSDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  'vault-usdt-savings': {
    description: <Trans>Vault deployed on Morpho with a single exposure to sUSDS collateralized debt.</Trans>,
    exposureTokens: ['sUSDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  'vault-tether-savings': {
    // PLACEHOLDER — this vault has no row in the APP-396 risk sheet.
    description: (
      <Trans>
        Supply USDT to access savings powered by Sky Protocol, with instant liquidity. The rate tracks the Sky
        Savings Rate and is variable.
      </Trans>
    ),
    exposureTokens: ['sUSDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  'vault-risk-capital': {
    description: (
      <Trans>Vault deployed on Morpho, with a single exposure to stUSDS collateralized debt.</Trans>
    ),
    exposureTokens: ['stUSDS', 'SKY'],
    liquidationRisk: <Trans>None</Trans>
  },
  fixed: {
    description: (
      <Trans>
        Fixed-yield markets powered by Pendle. The rate is locked when you enter and realized at market
        maturity.
      </Trans>
    ),
    exposureTokens: ['USDS'],
    liquidationRisk: <Trans>None</Trans>
  },
  stusds: {
    description: (
      <Trans>
        Access variable rates with SKY token-collateralized loans. Exposed to SKY price volatility and
        potential bad debt. Returns vary depending on market utilization.
      </Trans>
    ),
    exposureTokens: ['SKY'],
    liquidationRisk: <Trans>None</Trans>
  }
};

/**
 * The exposure fact renders as an overlapping token-icon stack — long token
 * lists read badly as text. Symbols must match /public/tokens/*.svg. On md+
 * hover reveals the names via the native title tooltip; below md (the
 * bottom-sheet surface) there is no hover, so tapping the stack opens a small
 * popover with the same names (PopoverContent is z-100, clearing the sheet's
 * z-50 layer).
 */
function ExposureFactValue({ symbols }: { symbols: string[] }) {
  const { bpi } = useBreakpointIndex();
  const names = symbols.join(', ');
  const stack = (
    <TokenIconStack
      symbols={symbols}
      size={16}
      data-testid="risk-details-exposure"
      title={names}
      aria-label={names}
    />
  );

  if (bpi >= BP.md) return stack;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="focus-visible:ring-ring inline-flex rounded-full focus-visible:ring-1 focus-visible:outline-hidden"
        >
          {stack}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="font-graphik text-fgPrimary bg-bgTertiary w-auto rounded-2xl px-3 py-2 text-[11px] leading-4 backdrop-blur-[20px]"
      >
        {names}
      </PopoverContent>
    </Popover>
  );
}

function FactRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    // items-start + right-aligned value: exposure token lists ("cbBTC, wstETH,
    // WETH and PT-sUSDS") wrap inside the 228px tooltip card.
    <div className="flex w-full items-start justify-between gap-3">
      <span className="font-graphik text-fgSecondary shrink-0 text-[11px] leading-4">{label}</span>
      <span className="font-circle text-fgPrimary text-right text-xs leading-3.5 font-medium tracking-[-0.24px]">
        {value}
      </span>
    </div>
  );
}

/** Scale + description + divider + fact rows — shared by the tooltip card and the bottom sheet. */
function RiskTierDetailsBody({ tier, profile }: { tier: EarnRiskTier; profile: EarnRiskProfileId }) {
  const { i18n } = useLingui();
  const severity = RISK_TIER_DETAILS[tier];
  const details = RISK_PROFILE_DETAILS[profile];

  return (
    <>
      <div className="flex w-full items-center gap-[3px]" data-testid="risk-details-scale">
        {[0, 1, 2].map(index => (
          <span
            key={index}
            data-testid="risk-details-segment"
            className={cn(
              'h-1 flex-1 rounded-full',
              index < severity.litSegments ? severity.segmentClass : 'bg-fgQuaternary'
            )}
          />
        ))}
      </div>
      <p className="font-graphik text-fgSecondary text-[11px] leading-4">{details.description}</p>
      <div className="border-borderPrimary w-full border-b" />
      <div className="flex w-full flex-col gap-1.5">
        <FactRow
          label={<Trans>Exposure</Trans>}
          value={<ExposureFactValue symbols={details.exposureTokens} />}
        />
        <FactRow label={<Trans>Liquidation risk</Trans>} value={details.liquidationRisk} />
        <FactRow label={<Trans>Withdrawals</Trans>} value={i18n._(withdrawalWording(profile))} />
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
  profile,
  className
}: {
  tier: EarnRiskTier;
  profile: EarnRiskProfileId;
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
      <RiskTierDetailsBody tier={tier} profile={profile} />
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
  profile,
  className
}: {
  profile: EarnRiskProfileId;
  className?: string;
}) {
  // The tier always resolves through the registry map so no surface (row,
  // detail page, portfolio card) can drift from the marketplace assignment.
  const tier = RISK_TIER_BY_PROFILE[profile];
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
            <RiskTierDetailsBody tier={tier} profile={profile} />
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
    // Own provider (same 300ms delay as the app root's) so the trigger is
    // self-contained on any surface — pages, cards, tests — with no host setup.
    <TooltipProvider delayDuration={300}>
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
            <RiskTierDetailsCard tier={tier} profile={profile} className="w-[228px]" />
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}
