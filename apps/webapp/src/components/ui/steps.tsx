import { ReactNode, useId } from 'react';
import { Trans } from '@lingui/react/macro';

import { cn } from '@/lib/cn';

// Design-system transaction-steps pattern (Figma "Patterns / Steps",
// 5200:30907 / 5200:30561 / 5119:21048). `Steps` is the assembled container
// (header badges + item list); `StepsItem` is one row (icon + connector +
// title). The Bundle flavour of the pattern has no per-item variant — bundled
// flows differ only in the header badge and in every step being active at
// once, both driven by the caller.

// 'failed' keeps the active icon/connector treatment (Figma 1030:139111 draws
// no red icon) — failure is conveyed by the retitled label + description row.
export type StepState = 'upcoming' | 'active' | 'completed' | 'failed';

// Figma Steps Icon Item (5119:21048): a 30px circle per state. Ring + fill are
// SVG (the active ring is a gradient stroke, which CSS borders can't do); the
// number is an HTML overlay so it uses the app font stack. Gradient stops map
// to existing tokens: ring = brandHover→fgBrand, fill = the button gradient
// pair. The completed greens (Figma bg/border-system-success-primary) have no
// theme token yet, so they stay literal.
function StepIcon({ state: rawState, stepNumber }: { state: StepState; stepNumber: number }) {
  const id = useId();
  const state = rawState === 'failed' ? 'active' : rawState;

  return (
    <div className="relative size-[30px] shrink-0">
      {state === 'completed' ? (
        <svg viewBox="0 0 30 30" className="absolute inset-0 size-full" aria-hidden="true">
          <circle cx="15" cy="15" r="14.5" fill="none" stroke="#02C2A1" />
          <circle cx="15" cy="15" r="12" fill="#00A186" />
          <path
            d="M19 12L13.5 17.5L11 15"
            fill="none"
            className="stroke-fgConsistent"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <>
          <svg viewBox="0 0 30 30" className="absolute inset-0 size-full" aria-hidden="true">
            {state === 'active' && (
              <defs>
                <linearGradient
                  id={`${id}-ring`}
                  x1="15"
                  y1="0"
                  x2="15"
                  y2="30"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="var(--color-brandHover)" />
                  <stop offset="1" stopColor="var(--color-fgBrand)" />
                </linearGradient>
                <linearGradient
                  id={`${id}-fill`}
                  x1="15"
                  y1="3"
                  x2="15"
                  y2="27"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="var(--color-button-gradient-start)" />
                  <stop offset="1" stopColor="var(--color-button-gradient-end)" />
                </linearGradient>
              </defs>
            )}
            <circle
              cx="15"
              cy="15"
              r="14.5"
              fill="none"
              stroke={state === 'active' ? `url(#${id}-ring)` : 'var(--color-borderTertiary)'}
            />
            <circle
              cx="15"
              cy="15"
              r="12"
              fill={state === 'active' ? `url(#${id}-fill)` : 'rgba(188,182,239,0.2)'}
            />
          </svg>
          <span
            className={cn(
              'font-circle absolute inset-0 flex items-center justify-center text-xs leading-3.5 font-medium tracking-[-0.24px]',
              state === 'active' ? 'text-fgConsistent' : 'text-fgSecondary'
            )}
          >
            {stepNumber}
          </span>
        </>
      )}
    </div>
  );
}

// The 2px connector under an item's icon fades from the item's state colour
// into the idle track colour (Figma colors/bg/bg-quarternary).
const connectorClasses: Record<StepState, string> = {
  upcoming: 'bg-[rgba(188,182,239,0.2)]',
  active: 'bg-linear-to-b from-brandHover to-[rgba(188,182,239,0.2)]',
  failed: 'bg-linear-to-b from-brandHover to-[rgba(188,182,239,0.2)]',
  completed: 'bg-linear-to-b from-[#00A186] to-[rgba(188,182,239,0.2)]'
};

export type StepsItemProps = {
  stepNumber: number;
  label: ReactNode;
  /** Token rendered as a chip after the label (Figma Title's Token slot). */
  tokenSymbol?: string;
  /** 14px icon node for the token chip — supplied by the caller (the primitive stays icon-source agnostic). */
  tokenIcon?: ReactNode;
  /** Grey helper paragraph under the label (Figma failure states, 1030:139111). */
  description?: ReactNode;
  /** Right-aligned node vertically centered on the row — e.g. the "Try again" pill. */
  trailingAction?: ReactNode;
  state?: StepState;
  /** Draw the connector line to the next item — every item except the last. */
  showConnector?: boolean;
  className?: string;
};

export function StepsItem({
  stepNumber,
  label,
  tokenSymbol,
  tokenIcon,
  description,
  trailingAction,
  state = 'upcoming',
  showConnector = false,
  className
}: StepsItemProps) {
  return (
    <li className={cn('flex w-full items-start gap-4', className)}>
      <div className="flex w-[30px] flex-col items-center gap-1 self-stretch">
        <StepIcon state={state} stepNumber={stepNumber} />
        {showConnector && (
          <div className={cn('min-h-px w-0.5 flex-1 rounded-full', connectorClasses[state])} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="font-circle text-fgPrimary flex min-h-[30px] items-center gap-1.5 text-base leading-4.5 font-medium tracking-[-0.32px]">
              {typeof label === 'string' ? <span className="truncate">{label}</span> : label}
              {tokenSymbol && (
                <span className="flex shrink-0 items-center gap-[3px]">
                  {tokenIcon}
                  <span>{tokenSymbol}</span>
                </span>
              )}
            </div>
            {/* Body 6 (12/18) per the Steps Item comp (859:36231 description). */}
            {description && <div className="text-fgSecondary text-xs leading-[18px]">{description}</div>}
          </div>
          {trailingAction && <div className="shrink-0 self-center">{trailingAction}</div>}
        </div>
        {/* Spacer giving the connector its run to the next item (Figma 5205:31478). */}
        {showConnector && <div className="h-5" aria-hidden="true" />}
      </div>
    </li>
  );
}

/** Header pill (Figma Badge, h-24): `brand` is the Bundled treatment, `default` the neutral one. */
export function StepsBadge({
  variant = 'default',
  children,
  className
}: {
  variant?: 'brand' | 'default';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-circle flex h-6 items-center gap-1 rounded-full px-2 text-xs leading-3.5 font-medium tracking-[-0.24px]',
        // Figma components/status/bg-brand + fg-brand — not theme tokens yet.
        variant === 'brand' ? 'bg-[rgba(156,160,229,0.1)] text-[#9CA9FF]' : 'bg-glassBadge text-fgSecondary',
        className
      )}
    >
      {children}
    </span>
  );
}

// Figma Icons/Custom/lightning-filled (12px), inlined for the Bundled badge.
function LightningIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M7 4.96875L7.33333 0.5H6.66667L2 7.03125H5L4.66667 11.5H5.33333L10 4.96875H7Z" />
    </svg>
  );
}

export type StepsProps = {
  /** Header title; defaults to "Actions". */
  title?: ReactNode;
  /** Show the "⚡ Bundled" badge next to the title (EIP-5792 batched flows). */
  bundled?: boolean;
  /** Right-aligned header badge content (e.g. "Confirm in the wallet"). */
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Assembled Steps Standard container (Figma 5200:30907): header row + item list. */
export function Steps({ title, bundled = false, badge, children, className }: StepsProps) {
  return (
    <div className={cn('flex w-full flex-col gap-5', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-fgSecondary text-sm leading-5.5">{title ?? <Trans>Actions</Trans>}</span>
          {bundled && (
            <StepsBadge variant="brand">
              <LightningIcon />
              <Trans>Bundled</Trans>
            </StepsBadge>
          )}
        </div>
        {badge && <StepsBadge>{badge}</StepsBadge>}
      </div>
      <ol className="flex flex-col gap-1">{children}</ol>
    </div>
  );
}
