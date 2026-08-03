import { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Switch } from '@/components/ui/switch';
import { tabsTriggerVariants } from '@/components/ui/tabs';

/**
 * Manage-sheet card shell (redesign comps 1036:213821+, flows UX 1050:21454):
 * a segmented mode control in place of the takeover's step number, plus the
 * enable toggle. Disabled cards collapse to their header row — same
 * temporal-states-of-one-screen model as F4. Mode pills are the design-system
 * Tabs chip (Figma 5029:51762) on plain buttons: aria-pressed carries the
 * toggle semantics, data-state drives the recipe's styling contract (same
 * non-Radix reuse as EarnTableFilters).
 */
export function StakeManageCard<Mode extends string>({
  modes,
  activeMode,
  onModeChange,
  enabled,
  onEnabledChange,
  dataTestId,
  children
}: {
  modes: { value: Mode; label: ReactNode }[];
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  dataTestId: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={dataTestId}
      className="bg-glassSurface rounded-card flex flex-col gap-6 p-5 backdrop-blur-[20px] md:gap-8 md:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5" role="group">
          {modes.map(mode => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onModeChange(mode.value)}
              aria-pressed={mode.value === activeMode}
              data-state={mode.value === activeMode ? 'active' : 'inactive'}
              data-testid={`${dataTestId}-mode-${mode.value}`}
              className={tabsTriggerVariants({ variant: 'pill' })}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} data-testid={`${dataTestId}-toggle`} />
      </div>
      {enabled && children}
    </section>
  );
}

/**
 * In-card stat cell (comps 1036:213889/213936): Body 6 label over a Label 5
 * Circular value; a staged change renders `current → next` with both values
 * white and a muted 12px arrow. Values arrive pre-formatted (token icons
 * included); the arrow only appears when a next value is passed.
 */
export function StakeManageStatCell({
  label,
  current,
  next,
  nextClassName,
  dataTestId
}: {
  label: ReactNode;
  current: ReactNode;
  /** The simulated value; pass undefined (or the same content) for no delta. */
  next?: ReactNode;
  nextClassName?: string;
  dataTestId?: string;
}) {
  const hasDelta = next !== undefined;
  return (
    <div data-testid={dataTestId} className="flex flex-col gap-1">
      <span className="text-textSecondary flex items-center gap-1 text-xs leading-[18px]">{label}</span>
      <span className="text-text font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px]">
        <span className="flex items-center gap-1">{current}</span>
        {hasDelta && (
          <>
            <ArrowRight className="text-textSecondary h-3 w-3 shrink-0" aria-hidden />
            <span className={cn('flex items-center gap-1', nextClassName)}>{next}</span>
          </>
        )}
      </span>
    </div>
  );
}

/** 32px vertical hairline between hugging stat cells (comps' Vector 461x). */
export const StakeManageStatDivider = () => (
  <span className="bg-borderPrimary h-8 w-px shrink-0 self-center" aria-hidden />
);

/** Badges XS neutral "Updated hourly" (comp 1594:43606): no icon, 11px Circular on the glass tint. */
export const UpdatedHourlyBadge = () => (
  <span className="bg-glassBadge text-textSecondary font-circle flex h-[18px] items-center rounded-full px-2 text-[11px] leading-none font-medium whitespace-nowrap">
    <Trans>Updated hourly</Trans>
  </span>
);
