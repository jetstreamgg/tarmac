import { ReactNode } from 'react';
import { AudioLines } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { StarsFilled } from '@/modules/icons';
import type { MorphoVaultRateData } from '@/hooks';

/**
 * Whether a vault's rate is boosted by reward incentives — i.e. whether there
 * is anything to mark and to break down. A vault without them has net ==
 * native, so every surface renders the bare figure.
 */
export function hasRateIncentives(rate?: MorphoVaultRateData): rate is MorphoVaultRateData {
  return !!rate && rate.rewards.length > 0;
}

/**
 * Whether there is anything to break a rate down INTO: reward incentives, or a
 * net rate that differs from the native one (a fee). The Risk Capital vaults
 * have neither — net equals native — so their Details row shows the bare
 * figure with no mark and no tooltip (Design QA follow-up, APP-550).
 */
export function hasRateBreakdown(rate?: MorphoVaultRateData): rate is MorphoVaultRateData {
  return !!rate && (rate.rewards.length > 0 || rate.netRate !== rate.rate);
}

/**
 * The DS stars mark that tags an incentive-boosted rate (Icons/Custom/
 * stars-filled). 12px wherever the comps draw it — beside the supply card's
 * Label 3 figure (859:37947) and inside the breakdown rows.
 */
export function VaultRateMark({ className }: { className?: string }) {
  return <StarsFilled className={cn('text-statusInfoSolid size-3 shrink-0', className)} aria-hidden />;
}

/**
 * Wraps whatever displays a Morpho net rate in the rate-breakdown tooltip
 * (Figma 1030:60841, APP-443 item 14): the net rate over a hairline, then the
 * native rate and one row per reward incentive. Fees stay out of it — the comp
 * only breaks the rate into what adds up to it.
 *
 * Every surface that shows the net rate on a vault product page wears this —
 * the supply card stat, the chart headline and the Details row — so the mark
 * and its explanation never appear on one and not the others.
 *
 * The tooltip only mounts when there is something to break down (see
 * `hasRateBreakdown`); by default that means an incentive-boosted vault.
 * Either way the children stay in ONE inline-flex box: the bare fragment used
 * to hand the figure and the mark to the row's value cell as two separate
 * flex children, and the mark wrapped under the figure.
 */
export function VaultRateTooltip({
  rate,
  className,
  children
}: {
  rate?: MorphoVaultRateData;
  className?: string;
  children: ReactNode;
}) {
  if (!hasRateBreakdown(rate)) {
    return <span className={cn('inline-flex items-center gap-1.5', className)}>{children}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex cursor-default items-center gap-1.5', className)}
          data-testid="vault-rate-breakdown"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          // The DS tooltip's 260px cap and 16px text would squeeze this
          // two-column breakdown; it keeps the shared chrome and takes the
          // comp's own 12px gap column.
          className="flex w-[260px] max-w-none flex-col gap-3"
          align="end"
        >
          <Row
            icon={<VaultRateMark />}
            label={<Trans>Net Rate</Trans>}
            value={rate.formattedNetRate}
            emphasis
          />
          <span className="bg-borderPrimary h-px w-full shrink-0" aria-hidden />
          <div className="flex flex-col gap-2">
            <Row
              icon={<AudioLines className="text-fgSecondary size-3 shrink-0" aria-hidden />}
              label={<Trans>Native Rate</Trans>}
              value={rate.formattedRate}
            />
            {rate.rewards.map(reward => (
              <Row
                key={reward.symbol}
                icon={
                  <TokenIcon
                    token={{ symbol: reward.symbol }}
                    width={12}
                    showChainIcon={false}
                    className="size-3 shrink-0"
                  />
                }
                label={<Trans>{reward.symbol} Rewards</Trans>}
                value={reward.formattedApy}
              />
            ))}
          </div>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}

/**
 * The Details-row flavour: the figure followed by the mark, both inside the
 * tooltip trigger (Design QA: "this area should be hoverable to see the
 * rewards/rate breakdown + the icon should be placed next to the value, not
 * below"). A vault with nothing to break down — no incentives, net equal to
 * native — shows the bare figure: no mark, no tooltip.
 */
export function VaultRateBreakdown({ rate, value }: { rate?: MorphoVaultRateData; value: string }) {
  return (
    <VaultRateTooltip rate={rate}>
      {value}
      {hasRateBreakdown(rate) && <VaultRateMark />}
    </VaultRateTooltip>
  );
}

/**
 * One breakdown line. The net row is the emphasised pair — Label 5 on
 * fg-primary both sides; the contributing rows pair a Body 6 fg-secondary
 * label with a Label 6 figure.
 */
function Row({
  icon,
  label,
  value,
  emphasis = false
}: {
  icon: ReactNode;
  label: ReactNode;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          emphasis
            ? 'text-fgPrimary font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px]'
            : 'text-fgSecondary flex items-center gap-1.5 text-xs leading-[18px]'
        }
      >
        {icon}
        {label}
      </span>
      <span
        className={
          emphasis
            ? 'text-fgPrimary font-circle text-sm leading-4 font-medium tracking-[-0.28px]'
            : 'text-fgPrimary font-circle text-xs leading-3.5 font-medium tracking-[-0.24px]'
        }
      >
        {value}
      </span>
    </div>
  );
}
