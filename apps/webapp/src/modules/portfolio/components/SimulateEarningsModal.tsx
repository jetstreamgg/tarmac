import { ReactNode, useEffect, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { Info, TrendingUp, X } from 'lucide-react';
import { formatDecimalPercentage, formatUsd, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RateBadge } from '@/components/ui/RateBadge';
import { RollingValue } from '@/components/ui/rolling-value';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { Text } from '@/modules/layout/components/Typography';
import {
  INITIAL_BALANCE,
  STEPS,
  balanceToStep,
  stepToBalance,
  stepToProgress
} from './simulateEarningsScale';

/**
 * "Simulate earnings with Sky Savings" modal (Figma 2800:92177): a balance
 * slider on a log-uniform scale whose Daily / Monthly / Yearly figures update
 * live from the current Sky Savings Rate (simple, non-compounded —
 * projections assume the rate holds).
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
  const [step, setStep] = useState(() => balanceToStep(INITIAL_BALANCE));
  const balance = stepToBalance(step);
  // While the thumb is being dragged the balance changes every frame, and a
  // roll (600ms / 400ms) would never get to finish — the glyphs would sit
  // mid-flight for the whole drag. So the figures swap instantly during a
  // pointer drag and roll again for discrete changes (keyboard steps, a
  // click on the track).
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [dragging]);

  const yearly = projectAnnualEarnings(balance, savingsRate);
  const monthly = yearly / 12;
  const daily = yearly / 365;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DS Modal card: colors/bg/bg-secondary at radius-2xl (28px) over the
          frosted scrim — the same dress as the transaction modal — with the
          comp's 32px padding and 48px between its three blocks. `gap-4` is
          the DialogContent default, overridden here. */}
      <DialogContent className="bg-bgSecondary flex flex-col gap-10 rounded-[28px] p-6 sm:max-w-[640px] sm:gap-12 sm:p-8">
        {/* Header: title column + close control as flex siblings (the comp
            top-aligns the 40px button with the title row). The column is
            `min-w-0` so long copy wraps inside it rather than under the
            button; the app's legal description is longer than the comp's. */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <DialogTitle className="text-text font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
                <Trans>Simulate your savings with the Sky Savings Rate</Trans>
              </DialogTitle>
              {/* DS Badges / Special — the rate reads green in the comp. */}
              <RateBadge>{formatDecimalPercentage(savingsRate)}</RateBadge>
            </div>
            <DialogDescription className="text-textSecondary text-xs leading-[18px]">
              <Trans>
                Projections assume the current rate held constant. The Sky Savings Rate is variable and
                updates daily; it is a protocol rate funded from aggregate Sky protocol surplus. sUSDS is not
                exposure to any specific Agent, borrower, collateral pool, or asset strategy. Not financial
                advice.
              </Trans>
            </DialogDescription>
          </div>
          {/* DS Button / Icon, secondary at 40px — the comp's close control
              (1030:58457, APP-443 item 17). */}
          <DialogClose asChild>
            <Button
              variant="secondary"
              size="iconM"
              className="shrink-0"
              data-testid="simulate-earnings-close"
            >
              <X aria-hidden />
              <span className="sr-only">
                <Trans>Close</Trans>
              </span>
            </Button>
          </DialogClose>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-textSecondary flex items-center gap-1">
              <Text variant="small" tag="span" className="text-xs leading-[18px]">
                <Trans>Balance supplied</Trans>
              </Text>
              <Info className="size-3" aria-hidden />
            </div>
            {/* Heading 3 with the comp's "numbers animation" — the whole figure
                rolls over as the slider moves. */}
            <span
              className="text-text font-circle text-[32px] leading-[35px] font-medium tracking-[-0.64px]"
              data-testid="simulate-earnings-balance"
            >
              <RollingValue value={formatUsd(balance)} instant={dragging} />
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Slider
              value={[step]}
              min={0}
              max={STEPS}
              step={1}
              onValueChange={([value]) => setStep(value)}
              onPointerDown={() => setDragging(true)}
              aria-label="Balance supplied"
              valueText={formatUsd(balance)}
            />
            <div className="text-fgSecondary flex items-center gap-4 text-xs leading-[18px]">
              <span>$50k</span>
              <SliderTicks progress={stepToProgress(step)} className="grow" />
              <span>$10M</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <Stat label={<Trans>Daily</Trans>} value={formatUsd(daily)} instant={dragging} />
          <Stat label={<Trans>Monthly</Trans>} value={formatUsd(monthly)} instant={dragging} divided />
          <Stat label={<Trans>Yearly</Trans>} value={formatUsd(yearly)} instant={dragging} divided />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One projection figure. The comp leads each Label 3 value with the 16px green
 * trending-up mark over a Body 6 label, and splits the three with 29.5px
 * hairlines rather than full-height column rules.
 */
function Stat({
  label,
  value,
  divided,
  instant
}: {
  label: ReactNode;
  value: string;
  divided?: boolean;
  instant?: boolean;
}) {
  return (
    <div className="flex items-center gap-10">
      {divided && <span className="bg-borderPrimary h-[29.5px] w-px shrink-0" aria-hidden />}
      <div className="flex flex-col gap-0.5">
        <Text variant="small" tag="span" className="text-textSecondary text-xs leading-[18px]">
          {label}
        </Text>
        <span className="text-text font-circle flex items-center gap-1.5 text-lg leading-[22px] font-medium tracking-[-0.36px]">
          <TrendingUp className="text-bullish size-4 shrink-0" aria-hidden />
          <RollingValue value={value} speed="stat" instant={instant} />
        </span>
      </div>
    </div>
  );
}
