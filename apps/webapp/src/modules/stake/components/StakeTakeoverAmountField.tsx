import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { AmountFieldHairline } from '@/components/product/amountFieldHairline';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/amountInput';
import { RollingDigits } from '@/components/ui/rolling-digits';
import {
  caretAfterCharacters,
  formatAmountForInput,
  groupAmountInput,
  ungroupAmountInput
} from '../lib/amountInput';

// SKY and USDS are 18-decimal on every deployment the stake module runs on.
const DECIMALS = 18;

const PERCENT_CHIPS = [25, 50, 100] as const;
// Borrow-more chips (Figma 3015:58333): 25/50/100 of the remaining headroom.
export const BORROW_PERCENT_CHIPS = [25, 50, 100] as const;

// Shared by the input and its visible copy so the caret lands on the glyphs.
const AMOUNT_TYPE =
  'font-circle text-[22px] leading-6 font-medium tracking-[-0.44px] md:text-[28px] md:leading-[30px] md:tracking-[-0.56px]';

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
 * animation); a typed digit pops in instead (3450:121929). A native input
 * can't animate its own text, so the input paints
 * its value transparent (keeping caret, selection and the keyboard) and a
 * pointer-transparent RollingDigits copy in the same type sits over it.
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
  const displayText = groupAmountInput(maskedText);

  const inputRef = useRef<HTMLInputElement>(null);
  // Caret to restore after the edit regroups the text (a mid-string delete or
  // replace changes the length, which would drop the caret to the end).
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });

  const onChange = (input: HTMLInputElement) => {
    const raw = input.value;
    const ungrouped = ungroupAmountInput(raw, displayText);
    // A delete that takes the last decimal takes the point with it ("124.9" →
    // "124"); a freshly typed point stays, decimals are on their way.
    const deleting = raw.length < displayText.length;
    const sanitized = sanitizeAmountInput(
      deleting && ungrouped.endsWith('.') ? ungrouped.slice(0, -1) : ungrouped,
      DECIMALS
    );
    const caret = input.selectionStart ?? raw.length;
    pendingCaret.current = caretAfterCharacters(
      groupAmountInput(sanitized),
      raw.slice(0, caret).replace(/,/g, '').length,
      raw[caret - 1] === ','
    );
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
            <span className="relative min-w-0 flex-1">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={displayText}
                ref={inputRef}
                onChange={event => onChange(event.target)}
                disabled={disabled}
                data-testid={dataTestId}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                  AMOUNT_TYPE,
                  // No kerning: the overlay draws each digit in its own box, where
                  // pairs can't kern, so the input must not kern either.
                  'caret-text placeholder:text-fgSecondary w-full min-w-0 bg-transparent text-transparent outline-none [font-kerning:none] disabled:opacity-50'
                )}
              />
              {/* Stays mounted on an empty value so the last digit can fade out over the placeholder. */}
              <span
                aria-hidden
                data-testid={`${dataTestId}-display`}
                className={cn(
                  AMOUNT_TYPE,
                  'text-text pointer-events-none absolute inset-0 overflow-hidden whitespace-nowrap [font-kerning:none]',
                  disabled && 'opacity-50'
                )}
              >
                {/* Typed digits pop in where they land; chips and the slider roll (Design QA 3450:121929).
                    Proportional figures keep the overlay's metrics identical to the
                    input's, so the native caret lands after the last glyph. */}
                <RollingDigits value={displayText} transition={typed ? 'pop' : 'roll'} proportional />
              </span>
            </span>
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
