import { ReactNode, useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';

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

/** Above this, the panel says so — the price you accept starts to hurt. */
const HIGH_SLIPPAGE_PERCENT = 1;

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

/** Clamp a raw percent string to the ceiling only; empty/NaN normalize to ''. */
function clampPercentMax(value: string, max: number): string {
  if (value === '') return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
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
  // A floor rather than 0: zero tolerance is never a working setting, it just
  // guarantees a revert. The ceiling stays generous — a thin market can need
  // real room — but the panel warns past `HIGH_SLIPPAGE_PERCENT`.
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

  // Only the ceiling clamps per keystroke — a keystroke floor rewrites the
  // "0" of "0.5" to the minimum. Empty or below-floor input commits nothing
  // (committing 0 pins apiMinOut to the quote, so any price tick reverts);
  // blur snaps a settled below-floor value up to the minimum.
  const handleCustomChange = (raw: string) => {
    const capped = clampPercentMax(raw, max);
    setRawInput(capped);
    if (capped === '') return;
    const decimal = percentStringToDecimal(capped);
    if (decimal * 100 < min) return;
    onChange(decimal);
  };

  const handleCustomBlur = () => {
    if (rawInput === '') return;
    const numeric = Number(rawInput);
    if (Number.isNaN(numeric) || numeric >= min) return;
    setRawInput(String(min));
    onChange(min / 100);
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
                    autoFocus
                    placeholder={decimalToPercentString(defaultValue)}
                    className="text-fgPrimary font-circle w-[52px] [appearance:textfield] bg-transparent text-right text-sm leading-4 font-medium tracking-[-0.28px] focus-visible:outline-hidden [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    type="number"
                    step="any"
                    min={min}
                    max={max}
                    inputMode="decimal"
                    value={rawInput}
                    onChange={e => handleCustomChange(e.target.value)}
                    onBlur={handleCustomBlur}
                    data-testid={`${dataTestId}-input`}
                  />
                  <span className="text-fgSecondary font-circle text-sm leading-4 font-medium">%</span>
                </span>
              </div>
              {percentStringToDecimal(rawInput) * 100 > HIGH_SLIPPAGE_PERCENT && (
                <p
                  className="text-statusWarning font-graphik mt-3 text-xs leading-[18px]"
                  data-testid={`${dataTestId}-high-warning`}
                >
                  <Trans>
                    A tolerance this high can fill well below the quoted amount. Only raise it if a trade
                    keeps failing.
                  </Trans>
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}
