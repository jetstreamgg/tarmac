import { ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { Info, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDecimalPercentage, formatUsd, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RateBadge } from '@/components/ui/RateBadge';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { Text } from '@/modules/layout/components/Typography';

// First-iteration slider bounds (per design): $50k–$10M, starting at $100k.
const MIN_BALANCE = 50_000;
const MAX_BALANCE = 10_000_000;
const STEP = 10_000;
const INITIAL_BALANCE = 100_000;

/**
 * "Simulate earnings with Sky Savings" modal: a balance slider whose Daily /
 * Monthly / Yearly figures update live from the current Sky Savings Rate
 * (simple, non-compounded — projections assume the rate holds).
 */
export function SimulateEarningsModal({
  open,
  onOpenChange,
  savingsRate
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savingsRate: number;
}) {
  const [balance, setBalance] = useState(INITIAL_BALANCE);

  const yearly = projectAnnualEarnings(balance, savingsRate);
  const monthly = yearly / 12;
  const daily = yearly / 365;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        {/* DS Button / Icon, secondary at 40px — the comp's close control
            (1030:58457, APP-443 item 17); it was a borderless ghost glyph. */}
        <DialogClose asChild>
          <Button
            variant="secondary"
            size="iconM"
            className="absolute top-8 right-8"
            data-testid="simulate-earnings-close"
          >
            <X aria-hidden />
            <span className="sr-only">
              <Trans>Close</Trans>
            </span>
          </Button>
        </DialogClose>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 pr-12">
            <DialogTitle className="text-text font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
              <Trans>Simulate your savings with the Sky Savings Rate</Trans>
            </DialogTitle>
            {/* DS Badges / Special — the rate reads green in the comp. */}
            <RateBadge>{formatDecimalPercentage(savingsRate)}</RateBadge>
          </div>
          <DialogDescription className="text-textSecondary text-sm">
            <Trans>
              Projections assume the current rate held constant. The Sky Savings Rate is variable and updates
              daily; it is a protocol rate funded from aggregate Sky protocol surplus. sUSDS is not exposure
              to any specific Agent, borrower, collateral pool, or asset strategy. Not financial advice.
            </Trans>
          </DialogDescription>
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <div className="text-textSecondary flex items-center gap-1.5">
            <Text variant="medium" tag="span">
              <Trans>Balance supplied</Trans>
            </Text>
            <Info className="h-3.5 w-3.5" />
          </div>
          <span className="text-text font-circle text-3xl leading-none font-medium">
            {formatUsd(balance)}
          </span>

          <div className="mt-2 flex flex-col gap-1.5">
            <Slider
              value={[balance]}
              min={MIN_BALANCE}
              max={MAX_BALANCE}
              step={STEP}
              onValueChange={([value]) => setBalance(value)}
              aria-label="Balance supplied"
            />
            <div className="text-fgSecondary flex items-center gap-4 text-xs">
              <span>$50k</span>
              <SliderTicks
                progress={((balance - MIN_BALANCE) / (MAX_BALANCE - MIN_BALANCE)) * 100}
                className="grow"
              />
              <span>$10M</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-y-4">
          <Stat label={<Trans>Daily</Trans>} value={formatUsd(daily)} />
          <Stat label={<Trans>Monthly</Trans>} value={formatUsd(monthly)} divided />
          <Stat label={<Trans>Yearly</Trans>} value={formatUsd(yearly)} divided />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One projection figure. The comp (1030:58467) leads each value with the 16px
 * green trending-up mark (APP-443 item 17) over a Body 6 label, and splits the
 * three with 29.5px hairlines rather than full-height column rules.
 */
function Stat({ label, value, divided }: { label: ReactNode; value: string; divided?: boolean }) {
  return (
    <div className={cn('flex items-center gap-10', divided && 'ml-10')}>
      {divided && <span className="bg-borderPrimary h-[29.5px] w-px shrink-0" aria-hidden />}
      <div className="flex flex-col gap-0.5">
        <Text variant="medium" tag="span" className="text-textSecondary">
          {label}
        </Text>
        <span className="text-text font-circle flex items-center gap-1.5 text-lg leading-[22px] font-medium tracking-[-0.36px]">
          <TrendingUp className="text-bullish h-4 w-4 shrink-0" aria-hidden />
          {value}
        </span>
      </div>
    </div>
  );
}
