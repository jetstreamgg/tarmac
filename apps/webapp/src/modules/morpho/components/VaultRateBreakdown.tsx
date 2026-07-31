import { ReactNode } from 'react';
import { AudioLines } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { StarsFilled } from '@/modules/icons';
import type { MorphoVaultRateData } from '@/hooks';

/**
 * The Morpho "Current Rate" figure, tagged with the DS stars mark and backed
 * by the rate-breakdown tooltip (Figma 1030:60841, APP-443 item 14): the net
 * rate over a hairline, then the native rate and one row per reward
 * incentive. Fees stay out of it — the comp only breaks the rate into what
 * adds up to it.
 *
 * A vault with no incentives has nothing to break down (net == native), so it
 * renders the bare figure with neither mark nor tooltip.
 */
export function VaultRateBreakdown({ rate, value }: { rate?: MorphoVaultRateData; value: string }) {
  const rewards = rate?.rewards ?? [];
  if (!rate || rewards.length === 0) return <>{value}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default items-center gap-1.5" data-testid="vault-rate-breakdown">
          {value}
          <StarsFilled className="text-statusInfoSolid size-3 shrink-0" aria-hidden />
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
            icon={<StarsFilled className="text-statusInfoSolid size-3 shrink-0" aria-hidden />}
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
            {rewards.map(reward => (
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
