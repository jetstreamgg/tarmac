import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatNumber } from '@/utils';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { ConvertTokenSelect, type ConvertTokenSymbol } from './ConvertTokenSelect';

const NO_VALUE = '–';
const PERCENT_OPTIONS = [25, 50, 100] as const;

const formatBalance = (balance: bigint | undefined, decimals: number) =>
  balance === undefined
    ? NO_VALUE
    : formatNumber(parseFloat(formatUnits(balance, decimals)), { maxDecimals: 2 });

/**
 * One side of the Convert card (Figma 486:31204/486:31210): a translucent
 * glass panel with the large amount top-left, USD value below it, token chip
 * top-right and balance below-right. The origin side is editable and offers
 * 25/50/100% shortcuts next to the chip; the target side is display-only (the
 * PSM rate is fixed, so the amount is always derived).
 *
 * The USD line mirrors the token amount 1:1 — both PSM tokens are USD
 * stablecoins and the swap is fee-free, the same simplification the legacy
 * widget made. The "0.00" placeholder renders in the primary text colour per
 * the Figma default frame (fg-primary, not the muted secondary).
 */
export function ConvertAmountInput({
  side,
  symbol,
  onTokenChange,
  value,
  onInput,
  balance,
  decimals,
  onPercentClick,
  isConnected
}: {
  side: 'from' | 'to';
  symbol: ConvertTokenSymbol;
  onTokenChange: (next: ConvertTokenSymbol) => void;
  /** Display string: the typed amount (from) or the derived amount (to). */
  value: string;
  onInput?: (raw: string) => void;
  balance: bigint | undefined;
  decimals: number;
  onPercentClick?: (percent: number) => void;
  isConnected: boolean;
}) {
  const isFrom = side === 'from';
  const usdValue = `$${value === '' ? '0.00' : formatNumber(parseFloat(value) || 0, { maxDecimals: 2 })}`;

  return (
    <div
      className="bg-glassSurface flex flex-col gap-1 px-8 py-6 backdrop-blur-[20px]"
      data-testid={`convert-${side}`}
    >
      <div className="flex items-center justify-between gap-3">
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          onChange={isFrom && onInput ? e => onInput(e.target.value) : undefined}
          readOnly={!isFrom}
          aria-label={isFrom ? t`Convert amount` : t`Amount received`}
          data-testid={`convert-${side}-amount`}
          className="text-text placeholder:text-text w-full min-w-0 bg-transparent text-[32px] leading-9 font-medium outline-none"
        />
        <span className="flex shrink-0 items-center gap-1.5">
          {isFrom && isConnected && onPercentClick && (
            <span className="flex items-center gap-1.5">
              {PERCENT_OPTIONS.map(percent => (
                // Design-system Button / Mini (Figma 5051:168712)
                <button
                  key={percent}
                  type="button"
                  onClick={() => onPercentClick(percent)}
                  data-testid={`convert-from-percent-${percent}`}
                  className={cn(buttonVariants({ variant: 'mini', size: 'mini' }))}
                >
                  {percent}%
                </button>
              ))}
            </span>
          )}
          <ConvertTokenSelect value={symbol} onChange={onTokenChange} dataTestId={`convert-${side}-token`} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Text className="text-textSecondary text-sm">{usdValue}</Text>
        <Text className="text-textSecondary text-sm" dataTestId={`convert-${side}-balance`}>
          <Trans>Balance</Trans>: {isConnected ? formatBalance(balance, decimals) : NO_VALUE}
        </Text>
      </div>
    </div>
  );
}
