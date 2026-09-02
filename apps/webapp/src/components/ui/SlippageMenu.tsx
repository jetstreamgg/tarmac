import { ReactNode, useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { sanitizeAmountInput } from '@/lib/amountInput';

/**
 * Shared slippage-settings menu (E1) — a gear trigger opening an Auto/Custom
 * popover. Owned by the DS layer so every trade surface (Pendle buy/sell/redeem,
 * Convert) renders the same control; behavior ports the legacy widget
 * PendleConfigMenu.
 *
 * Purely controlled + presentational: values are decimals (0.002 = 0.2%), the
 * caller owns persistence (e.g. usePendleSlippage's per-flow localStorage).
 */

const AUTO = 'auto';
const CUSTOM = 'custom';

/** Decimal slippage (e.g. 0.002 for 0.2%) → percentage string for the input. */
function decimalToPercentString(decimal: number): string {
  return (decimal * 100).toFixed(2).replace(/\.?0+$/, '');
}

/** Percentage string (e.g. "0.5") → decimal slippage (e.g. 0.005). */
function percentStringToDecimal(value: string): number {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return 0;
  return n / 100;
}

/**
 * Cap a raw percent string at `max`; empty/NaN normalize to ''.
 *
 * Only the ceiling is enforced per keystroke. A floor cannot be: every number
 * below it is also the prefix of a legal one, so clamping mid-typing rewrites
 * the leading '0' of '0.5' into the floor and lands the '5' as a whole percent
 * (APP-533 — the shape of the fix that had to be backed out of #1857). The
 * floor belongs on blur, once the text has stopped moving.
 */
function clampPercentMax(value: string, max: number): string {
  // A bare '.' is a decimal point with nothing after it yet — what a first tap
  // of the keypad's decimal key produces. `Number('.')` is NaN, so clamping it
  // would snap the field back to empty and land the next digit as a whole
  // percent (',5' typed as 0.5% arriving as 5%).
  if (value === '' || value === '.') return value;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  if (numeric > max) return String(max);
  return value;
}

/** Text the field can hold that names no number yet — not a zero tolerance. */
function isBlankInput(value: string): boolean {
  return value === '' || value === '.';
}

export interface SlippageMenuProps {
  /** Current slippage as a decimal (e.g. 0.002 for 0.2%). */
  value: number;
  /** Default slippage for the active flow as a decimal. */
  defaultValue: number;
  onChange: (decimal: number) => void;
  /**
   * Custom-input bounds, in percent. `min` is the floor a committed tolerance
   * snaps up to on blur, not a per-keystroke clamp — it sits below every
   * flow's default (the narrowest is Pendle redeem's 0.02%) so a deliberate
   * low tolerance stays reachable while 0% is not.
   */
  min?: number;
  max?: number;
  /** Explainer copy under the heading; a generic default is provided. */
  description?: ReactNode;
  /**
   * Trigger style override — the default is the standalone header gear; the
   * modal review grid renders a compact 14px inline gear (Figma 859:41322)
   * via `[&>svg]:size-3.5`-style classes here.
   */
  triggerClassName?: string;
  dataTestId?: string;
}

export function SlippageMenu({
  value,
  defaultValue,
  onChange,
  min = 0.01,
  max = 50,
  description,
  triggerClassName,
  dataTestId = 'slippage-menu'
}: SlippageMenuProps) {
  // Local raw string state for the input. Storing keystrokes as a string
  // (rather than reformatting from `value: number` on every render) is what
  // lets the user type "0.5" — `Number("0.") === 0` would otherwise round-trip
  // the in-progress "." away.
  const [rawInput, setRawInput] = useState<string>(() =>
    value !== defaultValue ? decimalToPercentString(value) : ''
  );

  // Ref mirror so the resync effect can read the latest text without listing
  // it as a dependency (which would re-fire per keystroke and clobber edits).
  const rawInputRef = useRef(rawInput);
  rawInputRef.current = rawInput;

  // Re-sync the input when the value changes from outside the menu
  // (e.g. flow change resets the default; Auto click sets to default).
  useEffect(() => {
    if (value === defaultValue) {
      setRawInput('');
      return;
    }
    const currentNumeric = percentStringToDecimal(rawInputRef.current);
    if (Math.abs(currentNumeric - value) > 1e-9) {
      setRawInput(decimalToPercentString(value));
    }
  }, [value, defaultValue]);

  const isCustom = value !== defaultValue;

  const handleCustomChange = (raw: string) => {
    // Masked to what this field can mean — digits and one decimal point, at
    // the two decimals it renders at. That is also what reads a decimal comma
    // as a point, the only separator iOS's keypad offers under most European
    // locales (APP-518), and what keeps the text a number now that the control
    // is text rather than number.
    const masked = clampPercentMax(sanitizeAmountInput(raw, 2), max);
    setRawInput(masked);

    // Commit only text that already names a usable tolerance. An empty field
    // means "still typing", and a sub-floor number is the prefix of a longer
    // one — committing either wrote a 0% tolerance straight to the caller's
    // storage, which pins the quote's minOut to the exact quoted amount and
    // reverts on any price movement (APP-533). Blur settles both cases.
    if (isBlankInput(masked)) return;
    const numeric = Number(masked);
    if (!Number.isNaN(numeric) && numeric >= min) onChange(percentStringToDecimal(masked));
  };

  const handleCustomBlur = () => {
    const text = rawInputRef.current;

    // Nothing was entered, so there is nothing to settle: put the tolerance
    // still in force back on screen rather than reading a cleared field as a
    // request for zero.
    if (isBlankInput(text)) {
      setRawInput(isCustom ? decimalToPercentString(value) : '');
      return;
    }

    const numeric = Number(text);
    const belowFloor = Number.isNaN(numeric) || numeric < min;
    setRawInput(decimalToPercentString(belowFloor ? min / 100 : numeric / 100));
    if (belowFloor) onChange(min / 100);
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'text-textSecondary hover:text-text data-[state=open]:text-text rounded-full p-1.5 transition-colors',
          triggerClassName
        )}
        aria-label={t`Open slippage settings`}
        data-testid={`${dataTestId}-trigger`}
      >
        <Settings className="h-5 w-5" />
      </PopoverTrigger>
      <PopoverContent
        // Same surface as PopoverInfo, which opens from a cell two along in
        // the same grid — they read as siblings rather than two dialects.
        className="bg-containerDark w-80 rounded-xl backdrop-blur-[50px]"
        data-testid={`${dataTestId}-content`}
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            {/* Label 3, the heading every modal/popover surface uses. */}
            <h3 className="text-fgPrimary font-circle text-base leading-5 font-medium tracking-[-0.32px]">
              <Trans>Slippage</Trans>
            </h3>
            <p className="text-fgSecondary font-graphik text-xs leading-[18px]">
              {description ?? (
                <Trans>
                  Maximum acceptable difference between the quoted amount and what the trade actually executes
                  at. Higher tolerance means a higher chance of fill but a worse price.
                </Trans>
              )}
            </p>
          </div>
          <Tabs
            className="w-full"
            defaultValue={isCustom ? CUSTOM : AUTO}
            onValueChange={tab => {
              if (tab === AUTO) {
                onChange(defaultValue);
              }
            }}
          >
            {/* Tabs2 (5039:73501): the DS's enclosed segmented control — the
                same recipe the detail chart's Rate/TVL and range toggles use. */}
            <TabsList variant="segmented">
              <TabsTrigger variant="segmented" value={AUTO} data-testid={`${dataTestId}-auto-tab`}>
                <Trans>Auto</Trans>
              </TabsTrigger>
              <TabsTrigger variant="segmented" value={CUSTOM} data-testid={`${dataTestId}-custom-tab`}>
                <Trans>Custom</Trans>
              </TabsTrigger>
            </TabsList>
            <TabsContent value={AUTO} className="mt-4">
              <div className="flex w-full items-center justify-between">
                <span className="text-fgSecondary font-graphik text-xs leading-[18px]">
                  <Trans>Max slippage</Trans>
                </span>
                <span className="text-fgPrimary font-circle text-sm leading-4 font-medium tracking-[-0.28px]">
                  {decimalToPercentString(defaultValue)}%
                </span>
              </div>
            </TabsContent>
            <TabsContent value={CUSTOM} className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-fgSecondary font-graphik text-xs leading-[18px]">
                  <Trans>Max slippage</Trans>
                </span>
                {/* Pill input, matching the glass-bordered controls the modals
                    use for their token pills and mini chips. */}
                <span className="border-glassBorder focus-within:border-borderTertiary flex h-8 items-center gap-0.5 rounded-full border px-3 transition-colors">
                  <input
                    placeholder={decimalToPercentString(defaultValue)}
                    className="text-fgPrimary font-circle w-[52px] [appearance:textfield] bg-transparent text-right text-sm leading-4 font-medium tracking-[-0.28px] focus-visible:outline-hidden [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    // Text, not number: a number control reports anything it
                    // cannot parse — a decimal comma included — as the empty
                    // string, so the keystroke never reaches the handler. The
                    // bounds are enforced by `clampPercentString` regardless.
                    type="text"
                    inputMode="decimal"
                    value={rawInput}
                    onChange={e => handleCustomChange(e.target.value)}
                    onBlur={handleCustomBlur}
                    data-testid={`${dataTestId}-input`}
                  />
                  <span className="text-fgSecondary font-circle text-sm leading-4 font-medium">%</span>
                </span>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}
