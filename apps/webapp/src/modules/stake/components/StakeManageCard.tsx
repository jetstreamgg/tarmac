import { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { StakeCardToggle } from './StakeCardToggle';
import { tabsTriggerVariants } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';

/**
 * Manage-sheet card shell (redesign comps 1036:213821+, flows UX 1050:21454):
 * a segmented mode control in place of the takeover's step number, plus the
 * enable toggle. Disabled cards collapse to their header row — same
 * temporal-states-of-one-screen model as F4. Mode pills are the design-system
 * Tabs chip (Figma 5029:51762) on plain buttons: aria-pressed carries the
 * toggle semantics, data-state drives the recipe's styling contract (same
 * non-Radix reuse as EarnTableFilters). While the card is toggled off the
 * pills are disabled (Design QA 2800:91832: "If the section is turned off by
 * the toggle the tabs should be disabled", Tabs State=Disabled) — switching
 * mode on a collapsed card would silently reset amounts the user can't see.
 */
export function StakeManageCard<Mode extends string>({
  modes,
  activeMode,
  onModeChange,
  enabled,
  onEnabledChange,
  toggleDisabled,
  toggleDisabledHint,
  dataTestId,
  children
}: {
  modes: { value: Mode; label: ReactNode }[];
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** The switch can't be turned on yet; `toggleDisabledHint` says why (hover/tap). */
  toggleDisabled?: boolean;
  toggleDisabledHint?: ReactNode;
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
              disabled={!enabled}
              aria-pressed={mode.value === activeMode}
              data-state={mode.value === activeMode ? 'active' : 'inactive'}
              data-testid={`${dataTestId}-mode-${mode.value}`}
              className={tabsTriggerVariants({ variant: 'pill' })}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <StakeCardToggle
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={toggleDisabled}
          disabledHint={toggleDisabledHint}
          dataTestId={`${dataTestId}-toggle`}
        />
      </div>
      {enabled && children}
    </section>
  );
}

/**
 * Stacked stat rows (Figma 3015:58333 cards): full-width label / value rows
 * split by hairlines; a staged change renders `current → next`.
 */
export function StakeManageStatRows({ children }: { children: ReactNode }) {
  return <div className="divide-borderPrimary flex flex-col divide-y">{children}</div>;
}

export function StakeManageStatRow({
  label,
  current,
  next,
  dataTestId
}: {
  label: ReactNode;
  current: ReactNode;
  /** The simulated value; pass undefined (or the same content) for no delta. */
  next?: ReactNode;
  dataTestId?: string;
}) {
  return (
    <div data-testid={dataTestId} className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-textSecondary flex shrink-0 items-center gap-1 text-xs leading-[18px]">
        {label}
      </span>
      <span className="text-text font-circle flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-right text-sm leading-4 font-medium tracking-[-0.28px]">
        <span className="flex items-center gap-1">{current}</span>
        {next !== undefined && (
          <>
            <ArrowRight className="text-textSecondary h-3 w-3 shrink-0" aria-hidden />
            <span className="flex items-center gap-1">{next}</span>
          </>
        )}
      </span>
    </div>
  );
}

/** Min-stake-to-borrow status (Figma "Reached" / "Not reached" badge on every manage frame). */
export function ReachedBadge({ reached }: { reached: boolean }) {
  return (
    <span
      data-testid="stake-min-stake-badge"
      data-reached={reached || undefined}
      className={cn(
        'font-circle flex h-[18px] items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]',
        reached ? 'bg-statusSuccess/10 text-statusSuccess' : 'bg-statusWarning/10 text-statusWarning'
      )}
    >
      {reached ? <Trans>Reached</Trans> : <Trans>Not reached</Trans>}
    </span>
  );
}

/** Badges XS neutral "Updated hourly" (comp 1594:43606): no icon, 11px Circular on the glass tint. */
export const UpdatedHourlyBadge = () => (
  <span className="bg-glassBadge text-textSecondary font-circle flex h-[18px] items-center rounded-full px-2 text-[11px] leading-none font-medium whitespace-nowrap">
    <Trans>Updated hourly</Trans>
  </span>
);
