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

/** Clamp a raw percent string into [min, max]; empty/NaN normalize to ''. */
function clampPercentString(value: string, min: number, max: number): string {
  // A bare '.' is a decimal point with nothing after it yet — what a first tap
  // of the keypad's decimal key produces. `Number('.')` is NaN, so clamping it
  // would snap the field back to empty and land the next digit as a whole
  // percent (',5' typed as 0.5% arriving as 5%).
  if (value === '' || value === '.') return value;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  if (numeric < min) return String(min);
  if (numeric > max) return String(max);
  return value;
}

export interface SlippageMenuProps {
  /** Current slippage as a decimal (e.g. 0.002 for 0.2%). */
  value: number;
  /** Default slippage for the active flow as a decimal. */
  defaultValue: number;
  onChange: (decimal: number) => void;
  /** Custom-input bounds, in percent. */
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
  min = 0,
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
    const clamped = clampPercentString(sanitizeAmountInput(raw, 2), min, max);
    setRawInput(clamped);
    onChange(clamped === '' ? 0 : percentStringToDecimal(clamped));
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
        className="w-[330px] rounded-[20px] shadow-xl backdrop-blur-2xl"
        data-testid={`${dataTestId}-content`}
      >
        <div className="flex w-full flex-col gap-5">
          <div className="space-y-3">
            <h3 className="text-text font-circle font-medium">
              <Trans>Slippage</Trans>
            </h3>
            <p className="text-textSecondary text-sm leading-relaxed">
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value={AUTO} data-testid={`${dataTestId}-auto-tab`}>
                <Trans>Auto</Trans>
              </TabsTrigger>
              <TabsTrigger value={CUSTOM} data-testid={`${dataTestId}-custom-tab`}>
                <Trans>Custom</Trans>
              </TabsTrigger>
            </TabsList>
            <TabsContent value={AUTO}>
              <div className="flex h-[60px] w-full items-center justify-between p-2">
                <span className="text-text text-sm">
                  <Trans>Max slippage:</Trans>
                </span>
                <span className="text-text ml-2 text-sm">{decimalToPercentString(defaultValue)}%</span>
              </div>
            </TabsContent>
            <TabsContent value={CUSTOM}>
              <div className="flex h-[60px] items-center justify-between gap-1 rounded-xl p-2">
                <span className="text-text text-sm">
                  <Trans>Max slippage:</Trans>
                </span>
                <span className="border-borderPrimary flex items-center rounded-xl border p-2">
                  <input
                    placeholder={t`Custom`}
                    className="text-text w-[55px] [appearance:textfield] bg-transparent text-right text-sm focus-visible:outline-hidden [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    // Text, not number: a number control reports anything it
                    // cannot parse — a decimal comma included — as the empty
                    // string, so the keystroke never reaches the handler. The
                    // bounds are enforced by `clampPercentString` regardless.
                    type="text"
                    inputMode="decimal"
                    value={rawInput}
                    onChange={e => handleCustomChange(e.target.value)}
                    data-testid={`${dataTestId}-input`}
                  />
                  <span className="text-text mt-[3px] text-xs">%</span>
                </span>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}
