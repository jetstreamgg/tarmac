import { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Switch } from '@/components/ui/switch';

/**
 * Manage-sheet card shell (UX 1050:21454): a segmented mode control in place of
 * the takeover's step number, plus the enable toggle. Disabled cards collapse
 * to their header row — same temporal-states-of-one-screen model as F4.
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
      className="bg-panel rounded-card flex flex-col gap-6 p-6 backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2" role="group">
          {modes.map(mode => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onModeChange(mode.value)}
              aria-pressed={mode.value === activeMode}
              data-testid={`${dataTestId}-mode-${mode.value}`}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                mode.value === activeMode
                  ? 'bg-surfaceAlt text-text'
                  : 'text-textSecondary hover:text-text'
              )}
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
 * Before→after info row (UX B.3): renders the current value alone until a
 * change is staged, then `current → next`. Values arrive pre-formatted; the
 * arrow only appears when the rendered strings differ.
 */
export function StakeManageDeltaRow({
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
    <div
      data-testid={dataTestId}
      className="border-textSecondary/10 flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-b-0"
    >
      <span className="text-textSecondary flex items-center gap-1">{label}</span>
      <span className="text-text flex items-center gap-2 font-medium">
        <span className={cn(hasDelta && 'text-textSecondary')}>{current}</span>
        {hasDelta && (
          <>
            <ArrowRight className="text-textSecondary h-3.5 w-3.5" aria-hidden />
            <span className={nextClassName}>{next}</span>
          </>
        )}
      </span>
    </div>
  );
}
