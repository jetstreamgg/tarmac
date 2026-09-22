import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { StakeCardBody } from './StakeCardBody';
import { StakeCardToggle } from './StakeCardToggle';

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
  toggleDisabled,
  toggleDisabledHint,
  dataTestId,
  children
}: {
  step: number;
  title: ReactNode;
  optional?: boolean;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** The switch can't be turned on yet; `toggleDisabledHint` says why (hover/tap). */
  toggleDisabled?: boolean;
  toggleDisabledHint?: ReactNode;
  dataTestId: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={dataTestId}
      // Design QA 3445:58550: every card fills with bg-secondary in both themes.
      className="bg-bgSecondary rounded-card flex flex-col p-5 md:p-8"
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
          <StakeCardToggle
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={toggleDisabled}
            disabledHint={toggleDisabledHint}
            dataTestId={`${dataTestId}-toggle`}
          />
        )}
      </div>
      <StakeCardBody open={enabled}>{children}</StakeCardBody>
    </section>
  );
}
