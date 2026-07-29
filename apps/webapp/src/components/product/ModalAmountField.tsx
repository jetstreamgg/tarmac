import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

const PERCENT_PRESETS = [25, 50, 100] as const;
export type PercentPreset = (typeof PERCENT_PRESETS)[number];

/**
 * Transaction-modal amount field (DS Input / Amount, comps 859:36036 /
 * 1104:128308): "Amount" label over a 24px token icon + Heading-3 input on the
 * left; balance line over the 25/50/100% mini-chips and the token selector on
 * the right; a hairline underlining the whole field. Shared by the modal entry
 * bodies (Savings first, siblings migrate per module).
 */
export function ModalAmountField({
  label,
  tokenSymbol,
  value,
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
  return (
    <div className="flex flex-col gap-4">
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
              onChange={e => onInput(e.target.value)}
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
            <div className="flex items-center gap-1">
              {PERCENT_PRESETS.map(pct => (
                <Button
                  key={pct}
                  variant="mini"
                  size="mini"
                  disabled={disabled}
                  onClick={() => onPercent(pct)}
                  // Figma draws these chips at Label 6 (12/14) in fg-primary, tighter than the mini size's Label 5.
                  className="text-fgPrimary text-xs leading-3.5 tracking-[-0.24px]"
                  data-testid={pct === 100 ? maxTestId : undefined}
                >
                  {pct}%
                </Button>
              ))}
            </div>
            {selector}
          </div>
        </div>
      </div>
      {error}
      <div className="border-borderPrimary border-t" aria-hidden />
    </div>
  );
}
