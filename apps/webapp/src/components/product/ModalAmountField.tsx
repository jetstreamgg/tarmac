import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { BP, useBreakpointIndex } from '@/hooks';
import { sanitizeAmountInput } from '@/lib/amountInput';
import { cn } from '@/lib/cn';

const PERCENT_PRESETS = [25, 50, 100] as const;
export type PercentPreset = (typeof PERCENT_PRESETS)[number];

/**
 * Transaction-modal amount field (DS Input / Amount, comps 859:36036 /
 * 1104:128308): "Amount" label over a 24px token icon + Heading-3 input on the
 * left; balance line over the 25/50/100% mini-chips and the token selector on
 * the right; a hairline underlining the whole field. Shared by the modal entry
 * bodies (Savings first, siblings migrate per module). Input is masked to a
 * plain decimal at the token's precision — `onInput` only ever sees a string
 * that parses exactly to the transacted amount (APP-492).
 */
export function ModalAmountField({
  label,
  tokenSymbol,
  value,
  decimals,
  onInput,
  disabled = false,
  balance,
  onPercent,
  selector,
  error,
  inputAriaLabel,
  inputTestId,
  maxTestId
}: {
  label: ReactNode;
  /** Symbol behind the 24px icon beside the input. */
  tokenSymbol: string;
  value: string;
  /** Token decimals — the mask caps the fraction at this many digits. */
  decimals: number;
  onInput: (raw: string) => void;
  disabled?: boolean;
  /** Right-aligned balance line (e.g. "Balance: 100,000.00"). */
  balance: ReactNode;
  onPercent: (pct: PercentPreset) => void;
  /** Token origin/destination dropdown (or static chip) beside the chips. */
  selector?: ReactNode;
  error?: ReactNode;
  inputAriaLabel?: string;
  inputTestId?: string;
  /** Test id for the 100% chip — the successor of the old "Max" button. */
  maxTestId?: string;
}) {
  // Sheet-tier rearrangement (Figma 486:21468): the selector pill moves up
  // under the balance line and the percent chips become a full-width
  // equal-thirds row BELOW the hairline. Keyed to the same tier that swaps the
  // modal chrome to the bottom Sheet, so field and chrome flip together — and
  // the chips render exactly once (duplicating them per tier would duplicate
  // maxTestId in the DOM).
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  // The only error signal the field gets: whatever the caller renders below the hairline.
  // A validation state doesn't need its own boolean prop — the presence of `error` already
  // says everything the hairline needs to know.
  const hasError = error != null;

  const percentChips = (
    <div className={cn('flex items-center gap-1', isMobile && 'mt-1 w-full')}>
      {PERCENT_PRESETS.map(pct => (
        <Button
          key={pct}
          variant="mini"
          size="mini"
          disabled={disabled}
          onClick={() => onPercent(pct)}
          // Figma draws these chips at Label 6 (12/14) in fg-primary, tighter than the mini size's Label 5.
          className={cn('text-fgPrimary text-xs leading-3.5 tracking-[-0.24px]', isMobile && 'flex-1')}
          data-testid={pct === 100 ? maxTestId : undefined}
        >
          {pct}%
        </Button>
      ))}
    </div>
  );

  return (
    // `group` carries the input's focus state down to the hairline below (DS Input /
    // Amount 5620:26710, Active variant) without a local focus-tracking state hook — the
    // hairline is a sibling, not a border on the input itself.
    <div className="group flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-40 flex-1 flex-col gap-2">
          <span className="font-graphik text-fgSecondary text-xs leading-[18px]">{label}</span>
          <div className="flex items-center gap-2">
            <TokenIcon
              token={{ symbol: tokenSymbol }}
              className="size-6 shrink-0"
              width={24}
              showChainIcon={false}
            />
            <input
              inputMode="decimal"
              placeholder="0"
              value={value}
              onChange={e => onInput(sanitizeAmountInput(e.target.value, decimals))}
              disabled={disabled}
              aria-label={inputAriaLabel}
              data-testid={inputTestId}
              className="font-circle text-fgPrimary placeholder:text-fgSecondary w-full min-w-0 bg-transparent text-[32px] leading-[35px] font-medium tracking-[-0.64px] outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <span className="font-graphik text-fgSecondary text-xs leading-[18px]">{balance}</span>
          <div className="flex items-center gap-4">
            {!isMobile && percentChips}
            {selector}
          </div>
        </div>
      </div>
      {error}
      {/* Default/Filled sit on the 0.2-alpha hairline; focus brightens to the 0.3-alpha
          token (DS Active variant — the field otherwise has no focus treatment at all);
          a validation error overrides both with the DS error red, regardless of focus.
          The amount, chips and token selector above stay in normal colours either way —
          only the hairline (and the caller's error line) redden. */}
      <div
        className={cn(
          'border-t',
          hasError ? 'border-statusError' : 'border-glassBorder group-focus-within:border-borderTertiary'
        )}
        aria-hidden
      />
      {isMobile && percentChips}
    </div>
  );
}
