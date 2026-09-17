import { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsTouchDevice } from '@/hooks';

/**
 * Card enable switch. While `disabled` with a `disabledHint`, the switch is
 * wrapped so the hint still opens: a disabled control fires no pointer events
 * of its own. Hover tooltip on pointer devices, tap popover on touch.
 */
export function StakeCardToggle({
  checked,
  onCheckedChange,
  disabled = false,
  disabledHint,
  dataTestId
}: {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  disabledHint?: ReactNode;
  dataTestId: string;
}) {
  const isTouchDevice = useIsTouchDevice();
  const control = (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      data-testid={dataTestId}
    />
  );
  if (!disabled || !disabledHint) return control;

  const hint = <div className={HINT_CLASS}>{disabledHint}</div>;
  if (isTouchDevice) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <span className="inline-flex" data-testid={`${dataTestId}-hint`}>
            {control}
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          className="bg-bgTertiary w-auto max-w-none rounded-2xl p-0 backdrop-blur-[20px]"
        >
          {hint}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={0} data-testid={`${dataTestId}-hint`}>
            {control}
          </span>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent align="end" className="max-w-none p-0">
            {hint}
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}

// Figma 3015:59102: 310px tooltip, 16px padding, title + copy (gap 8), then
// the 4px progress strip 16px below, filled with the slider's orange→yellow.
const HINT_CLASS = 'flex w-[310px] max-w-[310px] flex-col gap-4 p-4';

/** Tooltip body for the below-min-collateral Borrow switch (Figma 3015:59102). */
export function StakeMoreToBorrowHint({
  title,
  current,
  required,
  description
}: {
  title: ReactNode;
  current: bigint;
  required: bigint;
  description: ReactNode;
}) {
  const percent = required > 0n ? Math.min(100, Number((current * 100n) / required)) : 0;
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-fgPrimary font-circle text-sm leading-4 font-medium tracking-[-0.28px]">
          {title}
        </span>
        <span className="text-fgSecondary font-graphik text-[11px] leading-4">{description}</span>
      </div>
      <span
        className="bg-glassBadge block h-1 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="from-slider-yellow-start to-slider-yellow-end block h-full rounded-full bg-linear-to-r"
          style={{ width: `${percent}%` }}
        />
      </span>
    </>
  );
}
