import { ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { formatAmountForInput, parseAmountText, sanitizeAmountText } from '../lib/amountInput';

const PERCENT_CHIPS = [25, 50, 100] as const;
// Borrow caps the top chip at 75% (APP-426): staging the exact max puts the
// position on the liquidation boundary, where fee accrual alone tips it
// underwater.
export const BORROW_PERCENT_CHIPS = [25, 50, 75] as const;

/**
 * Takeover amount row (hi-fi 486:32657): "Amount" label with a right-aligned
 * balance/max line, a big icon+numeric input, and percent chips (25/50/100
 * unless overridden). Text is held locally while typing; programmatic amounts
 * (chips, slider) re-render the field through the exact re-parseable formatter.
 */
export function StakeTakeoverAmountField({
  tokenSymbol,
  amount,
  onAmountChange,
  label,
  topRight,
  onPercentClick,
  percentChips = PERCENT_CHIPS,
  disabled = false,
  error,
  maxDisplayDecimals,
  dataTestId
}: {
  tokenSymbol: string;
  amount: bigint;
  onAmountChange: (amount: bigint) => void;
  /** Field label; defaults to the takeover's plain "Amount". The manage sheet passes mode-specific labels ("Withdraw amount" …). */
  label?: ReactNode;
  topRight?: ReactNode;
  onPercentClick?: (percent: number) => void;
  percentChips?: readonly number[];
  disabled?: boolean;
  error?: string;
  /** Display-only decimal cap for programmatic amounts (exact-max staging). */
  maxDisplayDecimals?: number;
  dataTestId: string;
}) {
  const [text, setText] = useState('');
  const errorId = `${dataTestId}-error`;
  // Controlled from outside: when the prop no longer matches the typed text
  // (chip click, slider drag, toggle reset), re-derive the text from the amount.
  const displayText =
    parseAmountText(text) === amount ? text : formatAmountForInput(amount, maxDisplayDecimals);

  const onChange = (raw: string) => {
    const sanitized = sanitizeAmountText(raw);
    setText(sanitized);
    onAmountChange(parseAmountText(sanitized));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-fgSecondary text-xs leading-[18px]">{label ?? <Trans>Amount</Trans>}</span>
        {topRight && <span className="text-fgSecondary text-xs leading-[18px]">{topRight}</span>}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TokenIcon token={{ symbol: tokenSymbol }} width={24} className="h-6 w-6" showChainIcon={false} />
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={displayText}
            onChange={event => onChange(event.target.value)}
            disabled={disabled}
            data-testid={dataTestId}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              // Heading 5 on phones, Heading 4 (28/30, −0.56) from md up.
              'text-text placeholder:text-fgSecondary font-circle w-full min-w-0 bg-transparent text-[22px] leading-6 font-medium tracking-[-0.44px] outline-none disabled:opacity-50 md:text-[28px] md:leading-[30px] md:tracking-[-0.56px]',
              error && 'text-error'
            )}
          />
        </div>
        {onPercentClick && (
          <div className="flex shrink-0 items-center gap-1">
            {percentChips.map(percent => (
              // Design-system Button / Mini (Figma 5051:168712); the base
              // recipe's solid disabled fill is swapped back for the field's
              // subtler faded look. Both tiers carry the comps' Label 6 digit
              // (1222:19764 · 1294:37495) — mobile on a 32px chip, md+ on the
              // 8/6 inset the takeover draws.
              <button
                key={percent}
                type="button"
                disabled={disabled}
                onClick={() => onPercentClick(percent)}
                data-testid={`${dataTestId}-percent-${percent}`}
                className={cn(
                  buttonVariants({ variant: 'mini', size: 'mini' }),
                  'h-8 px-2.5 text-xs leading-[14px] tracking-[-0.24px] md:h-auto md:px-2 md:py-1.5',
                  'disabled:text-text disabled:bg-transparent disabled:opacity-50'
                )}
              >
                {percent}%
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <span id={errorId} data-testid={errorId} className="text-error text-sm">
          {error}
        </span>
      )}
    </div>
  );
}
