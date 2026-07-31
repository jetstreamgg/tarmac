import { ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDecimalPercentage, formatUsd, projectAnnualEarnings } from '@/utils';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
        <DialogClose className="text-textSecondary hover:text-text absolute top-5 right-5 transition-colors">
          <X className="h-5 w-5" />
          <span className="sr-only">
            <Trans>Close</Trans>
          </span>
        </DialogClose>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="text-text font-circle text-lg font-medium">
              <Trans>Simulate earnings with Sky Savings</Trans>
            </DialogTitle>
            <Pill>{formatDecimalPercentage(savingsRate)}</Pill>
          </div>
          <DialogDescription className="text-textSecondary text-sm">
            <Trans>
              Projections assume current rate held constant. Sky Savings Rate is variable and updates daily.
              Not financial advice.
            </Trans>
          </DialogDescription>
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <div className="text-textSecondary flex items-center gap-1.5">
            <Text variant="medium" tag="span">
              <Trans>Balance deposited</Trans>
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
              aria-label="Balance deposited"
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

        <div className="border-borderPrimary mt-4 grid grid-cols-3 border-t pt-4">
          <Stat label={<Trans>Daily</Trans>} value={formatUsd(daily)} />
          <Stat label={<Trans>Monthly</Trans>} value={formatUsd(monthly)} divided />
          <Stat label={<Trans>Yearly</Trans>} value={formatUsd(yearly)} divided />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, divided }: { label: ReactNode; value: string; divided?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1.5 px-4', divided && 'border-borderPrimary border-l')}>
      <Text variant="medium" tag="span" className="text-textSecondary">
        {label}
      </Text>
      <span className="text-text font-circle text-lg font-medium">{value}</span>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="bg-surface text-text font-circle rounded-full px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}
