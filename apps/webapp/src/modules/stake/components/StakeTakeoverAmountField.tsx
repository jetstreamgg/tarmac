import { ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { AmountFieldHairline } from '@/components/product/amountFieldHairline';
import { AmountInput } from '@/components/product/AmountInput';
import { parseAmountInput } from '@/lib/amountInput';
import { formatAmountForInput } from '../lib/amountInput';

// SKY and USDS are 18-decimal on every deployment the stake module runs on.
const DECIMALS = 18;

const PERCENT_CHIPS = [25, 50, 100] as const;
// Borrow-more chips (Figma 3015:58333): 25/50/100 of the remaining headroom.
export const BORROW_PERCENT_CHIPS = [25, 50, 100] as const;

const AMOUNT_TYPE =
  'font-circle text-text placeholder:text-fgSecondary text-[22px] leading-6 font-medium tracking-[-0.44px] md:text-[28px] md:leading-[30px] md:tracking-[-0.56px]';

/** Labelled chip (Figma "Min" / "Max"): renders in place of the percent chips. */
export type AmountChip = { key: string; label: ReactNode; onClick: () => void };

/**
 * Takeover amount row (hi-fi 486:32657): "Amount" label with a right-aligned
 * balance/max line, a big icon+numeric input, and percent chips (25/50/100
 * unless overridden). Text is held locally while typing; programmatic amounts
 * (chips, slider) re-render the field through the exact re-parseable formatter.
 *
 * The figure reads grouped (`17,640.49`) and turns over digit by digit as the
 * slider or a chip moves it (Design QA 3314:135843, the global number
 * animation); a typed digit pops in instead (3450:121929). Both come from the
 * shared AmountInput; this wrapper only owns the bigint round trip.
 */
export function StakeTakeoverAmountField({
  tokenSymbol,
  amount,
  onAmountChange,
  label,
  topRight,
  onPercentClick,
  percentChips = PERCENT_CHIPS,
  chips,
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
  /** Labelled chips; when given they replace the percent chips. */
  chips?: readonly AmountChip[];
  disabled?: boolean;
  error?: string;
  /** Display-only decimal cap for programmatic amounts (exact-max staging). */
  maxDisplayDecimals?: number;
  dataTestId: string;
}) {
  const [text, setText] = useState('');
  // The amount the last keystroke set out from: the parent may deliver the
  // typed amount a render later, and until then the field is still typing.
  const [typedFrom, setTypedFrom] = useState<bigint | null>(null);
  const errorId = `${dataTestId}-error`;
  // Controlled from outside: when the prop no longer matches the typed text
  // (chip click, slider drag, toggle reset), re-derive the text from the amount.
  const settled = parseAmountInput(text, DECIMALS) === amount;
  if (settled && typedFrom !== null) setTypedFrom(null);
  const typed = settled || amount === typedFrom;
  const maskedText = typed ? text : formatAmountForInput(amount, maxDisplayDecimals);

  const onChange = (sanitized: string) => {
    setText(sanitized);
    setTypedFrom(amount);
    onAmountChange(parseAmountInput(sanitized, DECIMALS));
  };

  return (
    // `group` carries hover/focus down to the AmountFieldHairline sibling below
    // (DS Input / Amount 5620:26710, Hover/Active variants) — same convention
    // ModalAmountField uses, so the recipe lives in one shared component
    // instead of being re-derived per caller.
    <div className="group flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-fgSecondary text-xs leading-[18px]">{label ?? <Trans>Amount</Trans>}</span>
        {topRight && <span className="text-fgSecondary text-right text-xs leading-[18px]">{topRight}</span>}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TokenIcon token={{ symbol: tokenSymbol }} width={24} className="h-6 w-6" showChainIcon={false} />
            <AmountInput
              value={maskedText}
              onChange={onChange}
              decimals={DECIMALS}
              disabled={disabled}
              ariaInvalid={!!error}
              ariaDescribedBy={error ? errorId : undefined}
              className={AMOUNT_TYPE}
              dataTestId={dataTestId}
            />
          </div>
          {(chips || onPercentClick) && (
            <div className="flex shrink-0 items-center gap-1">
              {(
                chips ??
                percentChips.map(percent => ({
                  key: `percent-${percent}`,
                  label: `${percent}%`,
                  onClick: () => onPercentClick?.(percent)
                }))
              ).map(chip => (
                // Design-system Button / Mini (Figma 5051:168712); the base
                // recipe's solid disabled fill is swapped back for the field's
                // subtler faded look. Both tiers carry the comps' Label 6 digit
                // (1222:19764 · 1294:37495) — mobile on a 32px chip, md+ on the
                // 8/6 inset the takeover draws.
                <button
                  key={chip.key}
                  type="button"
                  disabled={disabled}
                  onClick={chip.onClick}
                  data-testid={`${dataTestId}-${chip.key}`}
                  className={cn(
                    buttonVariants({ variant: 'mini', size: 'mini' }),
                    'h-8 px-2.5 text-xs leading-[14px] tracking-[-0.24px] md:h-auto md:px-2 md:py-1.5',
                    'disabled:text-text disabled:bg-transparent disabled:opacity-50'
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* DS Input / Amount hairline (5620:26710) — recipe owned by
            AmountFieldHairline, shared with ModalAmountField. 16px down from
            the value row (this wrapper's gap-4); 4px down to the error
            message when present, via the nested gap-1 column. */}
        <div className="flex flex-col gap-1">
          <AmountFieldHairline hasError={!!error} />
          {error && (
            <span id={errorId} data-testid={errorId} className="text-statusError text-sm">
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
