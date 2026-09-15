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

  const hint = <div className="flex flex-col gap-2">{disabledHint}</div>;
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
          className="bg-bgTertiary text-fgPrimary font-graphik w-auto max-w-[260px] rounded-2xl text-[11px] leading-4 font-normal backdrop-blur-[20px]"
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
          <TooltipContent align="end">{hint}</TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Tooltip body for the below-min-collateral Borrow switch: title + progress strip. */
export function StakeMoreToBorrowHint({
  title,
  current,
  required,
  currentLabel
}: {
  title: ReactNode;
  current: bigint;
  required: bigint;
  currentLabel: ReactNode;
}) {
  const percent = required > 0n ? Math.min(100, Number((current * 100n) / required)) : 0;
  return (
    <>
      <span className="font-medium">{title}</span>
      <span className="bg-glassBadge block h-1 w-full overflow-hidden rounded-full">
        <span className="bg-statusSuccess block h-full rounded-full" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-fgSecondary">{currentLabel}</span>
    </>
  );
}
