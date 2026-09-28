import { ClipboardEvent, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  caretAfterCharacters,
  groupAmountInput,
  readPastedAmount,
  sanitizeAmountInput,
  ungroupAmountInput
} from '@/lib/amountInput';
import { type DigitTransition, RollingDigits } from '@/components/ui/rolling-digits';

/**
 * The amount input every amount field in the app is built on: a masked
 * decimal (APP-492) shown grouped by thousands (Design QA 3314:135843), whose
 * digits pop in as they are typed and roll when a chip or slider sets the
 * value (3450:121929). Paste is read as a figure, not keystrokes.
 *
 * `value` is the plain masked text (`17640.49`, never grouped) and `onChange`
 * hands back the same shape, so callers keep storing what they store today.
 * A native input can't animate its own text, so the input paints its value
 * transparent (keeping caret, selection and the keyboard) and a
 * pointer-transparent RollingDigits copy in the same type sits over it. The
 * copy pops when `value` arrives as what this input last emitted, and rolls
 * when something else (a chip, a slider, a reset) set it.
 */
export function AmountInput({
  value,
  onChange,
  decimals,
  placeholder = '0.00',
  className,
  disabled = false,
  ariaLabel,
  ariaInvalid,
  ariaDescribedBy,
  dataTestId
}: {
  value: string;
  onChange: (value: string) => void;
  /** Token decimals — the mask caps the fraction at this many digits. */
  decimals: number;
  placeholder?: string;
  /** Type classes, applied to the input and its visible copy alike. */
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  dataTestId?: string;
}) {
  const displayText = groupAmountInput(value);
  // Decided once per value change and then held: a keystroke the caller
  // refuses leaves `value` as it was, and re-keying the figure for that would
  // roll every digit over nothing. `emitted` is what the last edit handed the
  // caller; the change that brings it back is typing, any other is not.
  const [seen, setSeen] = useState({
    value,
    transition: 'roll' as DigitTransition,
    emitted: null as string | null
  });
  if (seen.value !== value) {
    setSeen({ value, transition: value === seen.emitted ? 'pop' : 'roll', emitted: null });
  }
  const transition = seen.value === value ? seen.transition : value === seen.emitted ? 'pop' : 'roll';

  const inputRef = useRef<HTMLInputElement>(null);
  // Caret to restore after the edit regroups the text (a mid-string delete or
  // replace changes the length, which would drop the caret to the end).
  const pendingCaret = useRef<{ characters: number; afterSeparator: boolean } | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    const { characters, afterSeparator } = pendingCaret.current;
    pendingCaret.current = null;
    const caret = caretAfterCharacters(displayText, characters, afterSeparator);
    inputRef.current?.setSelectionRange(caret, caret);
  });

  const applyEdit = (raw: string, caret: number) => {
    const ungrouped = ungroupAmountInput(raw, displayText);
    // A delete that takes the last decimal takes the point with it ("124.9" →
    // "124"); a freshly typed point stays, decimals are on their way.
    const deleting = raw.length < displayText.length;
    const sanitized = sanitizeAmountInput(
      deleting && ungrouped.endsWith('.') ? ungrouped.slice(0, -1) : ungrouped,
      decimals
    );
    pendingCaret.current = {
      characters: raw.slice(0, caret).replace(/,/g, '').length,
      afterSeparator: raw[caret - 1] === ','
    };
    setSeen(current => ({ ...current, emitted: sanitized }));
    onChange(sanitized);
  };
  const onInput = (input: HTMLInputElement) =>
    applyEdit(input.value, input.selectionStart ?? input.value.length);
  // A paste is handled here, not by the browser: a grouped figure keeps its
  // value and anything the mask could not show is refused outright.
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = readPastedAmount(event.clipboardData.getData('text'));
    if (pasted === null) return;
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    applyEdit(`${input.value.slice(0, start)}${pasted}${input.value.slice(end)}`, start + pasted.length);
  };

  return (
    <span className="relative block min-w-0 flex-1">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={displayText}
        ref={inputRef}
        onChange={event => onInput(event.target)}
        onPaste={onPaste}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        data-testid={dataTestId}
        className={cn(
          className,
          // No kerning: the overlay draws each digit in its own box, where
          // pairs can't kern, so the input must not kern either.
          'caret-text w-full min-w-0 bg-transparent text-transparent outline-none [font-kerning:none] disabled:cursor-not-allowed disabled:opacity-50'
        )}
      />
      {/* Stays mounted on an empty value so the last digit can fade out over the placeholder. */}
      <span
        aria-hidden
        data-testid={dataTestId && `${dataTestId}-display`}
        className={cn(
          className,
          'pointer-events-none absolute inset-0 overflow-hidden whitespace-nowrap [font-kerning:none]',
          disabled && 'opacity-50'
        )}
      >
        {/* Proportional figures keep the overlay's metrics identical to the
            input's, so the native caret lands after the last glyph. */}
        <RollingDigits value={displayText} transition={transition} proportional />
      </span>
    </span>
  );
}
