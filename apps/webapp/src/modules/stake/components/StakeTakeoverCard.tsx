import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Switch } from '@/components/ui/switch';

/**
 * Numbered takeover card (hi-fi 486:32657): circled step number + title
 * (+ muted "(Optional)" and an enable toggle for cards 2/3). Optional cards
 * collapse to their header row while disabled — temporal states of one screen,
 * not wizard steps.
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
      className="bg-glassSurface rounded-card flex flex-col gap-6 p-5 backdrop-blur-[20px] md:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="border-glassBorder md:border-borderPrimary text-text font-circle flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm leading-4 font-medium tracking-[-0.28px] md:font-sans md:leading-5 md:tracking-normal">
            {step}
          </span>
          <h3 className="text-text font-circle flex items-baseline gap-2 text-sm leading-4 font-medium tracking-[-0.28px] md:font-sans md:text-lg md:leading-normal md:tracking-normal">
            {title}
            {optional && (
              <span className="text-fgSecondary md:text-textSecondary font-sans text-xs leading-[18px] font-normal tracking-normal md:text-sm md:leading-5">
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
