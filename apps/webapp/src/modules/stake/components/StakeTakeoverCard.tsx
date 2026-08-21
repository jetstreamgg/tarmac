import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';

/**
 * Numbered takeover card (Modal / 10 · 12 · 17, 1036:209510+): circled step
 * number + title (+ muted "(Optional)" and an enable toggle for cards 2/3).
 * Optional cards collapse to their header row while disabled — temporal states
 * of one screen, not wizard steps. 32px inset and 32px between the header and
 * the body at md+; the collapsed card is exactly header + 2×32.
 */
export function StakeTakeoverCard({
  step,
  title,
  optional = false,
  enabled = true,
  onEnabledChange,
  dataTestId,
  children
}: {
  step: number;
  title: ReactNode;
  optional?: boolean;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  dataTestId: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={dataTestId}
      className={cn(
        // The C1 annotation ("bg-secondary looks very dark") is a dark-mode-only
        // complaint: bgTertiary (10% dark / 40% light) reads correctly against
        // the dark page, but its 40% light value is noticeably thinner than the
        // 60% white glassSurface/card/bgSecondary already share, and washes out
        // against the pale light-mode page background. So the swap is scoped to
        // dark; light keeps the pre-existing glassSurface value. Don't collapse
        // this back to one token.
        'bg-bgTertiary rounded-card flex flex-col gap-6 p-5 backdrop-blur-[20px] md:gap-8 md:p-8',
        'light:bg-glassSurface'
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="border-glassBorder text-text font-circle flex h-8 w-8 shrink-0 items-center justify-center rounded-[20px] border text-sm leading-4 font-medium tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]">
            {step}
          </span>
          <h3 className="text-text font-circle flex items-baseline gap-2 text-sm leading-4 font-medium tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]">
            {title}
            {optional && (
              <span className="text-fgSecondary font-sans text-xs leading-[18px] font-normal tracking-normal">
                <Trans>(Optional)</Trans>
              </span>
            )}
          </h3>
        </div>
        {optional && (
          <Switch checked={enabled} onCheckedChange={onEnabledChange} data-testid={`${dataTestId}-toggle`} />
        )}
      </div>
      {enabled && children}
    </section>
  );
}
