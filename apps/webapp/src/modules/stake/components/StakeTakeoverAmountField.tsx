import { ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { cn } from '@/lib/cn';
import { formatAmountForInput, parseAmountText, sanitizeAmountText } from '../lib/amountInput';

const PERCENT_CHIPS = [25, 50, 100] as const;

/**
 * Takeover amount row (hi-fi 486:32657): "Amount" label with a right-aligned
 * balance/max line, a big icon+numeric input, and 25/50/100% chips. Text is
 * held locally while typing; programmatic amounts (chips, slider) re-render the
 * field through the exact re-parseable formatter.
 */
export function StakeTakeoverAmountField({
  tokenSymbol,
  amount,
  onAmountChange,
  label,
  topRight,
  onPercentClick,
  disabled = false,
  error,
  dataTestId
}: {
  tokenSymbol: string;
  amount: bigint;
  onAmountChange: (amount: bigint) => void;
  /** Field label; defaults to the takeover's plain "Amount". The manage sheet passes mode-specific labels ("Withdraw amount" …). */
  label?: ReactNode;
  topRight?: ReactNode;
  onPercentClick?: (percent: number) => void;
  disabled?: boolean;
  error?: string;
  dataTestId: string;
}) {
  const [text, setText] = useState('');
  // Controlled from outside: when the prop no longer matches the typed text
  // (chip click, slider drag, toggle reset), re-derive the text from the amount.
  const displayText = parseAmountText(text) === amount ? text : formatAmountForInput(amount);

  const onChange = (raw: string) => {
    const sanitized = sanitizeAmountText(raw);
    setText(sanitized);
    onAmountChange(parseAmountText(sanitized));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-textSecondary text-sm">{label ?? <Trans>Amount</Trans>}</span>
        {topRight && <span className="text-textSecondary text-sm">{topRight}</span>}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TokenIcon token={{ symbol: tokenSymbol }} width={28} className="h-7 w-7" showChainIcon={false} />
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={displayText}
            onChange={event => onChange(event.target.value)}
            disabled={disabled}
            data-testid={dataTestId}
            aria-invalid={!!error}
            className={cn(
              'text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-3xl font-medium tracking-tight outline-none disabled:opacity-50',
              error && 'text-error'
            )}
          />
        </div>
        {onPercentClick && (
          <div className="flex shrink-0 items-center gap-1.5">
            {PERCENT_CHIPS.map(percent => (
              <button
                key={percent}
                type="button"
                disabled={disabled}
                onClick={() => onPercentClick(percent)}
                data-testid={`${dataTestId}-percent-${percent}`}
                className="border-borderPrimary text-textSecondary hover:text-text rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {percent}%
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <span data-testid={`${dataTestId}-error`} className="text-error text-sm">
          {error}
        </span>
      )}
    </div>
  );
}
