import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatNumber } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { ConvertTokenSelect, type ConvertTokenSymbol } from './ConvertTokenSelect';

const NO_VALUE = '–';
const PERCENT_OPTIONS = [25, 50, 100] as const;

const formatBalance = (balance: bigint | undefined, decimals: number) =>
  balance === undefined ? NO_VALUE : formatNumber(parseFloat(formatUnits(balance, decimals)), { maxDecimals: 2 });

/**
 * One side of the Convert card (Figma 486:31193 / 486:31219): large amount, USD
 * value below-left, token chip top-right, balance below-right. The origin side is
 * editable and reveals 25/50/100% pills next to the chip on hover/focus; the target
 * side is display-only (the PSM rate is fixed, so the amount is always derived).
 *
 * The USD line mirrors the token amount 1:1 — both PSM tokens are USD stablecoins
 * and the swap is fee-free, the same simplification the legacy widget made.
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
    <div className="group flex flex-col gap-1 px-6 py-5" data-testid={`convert-${side}`}>
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
          className="text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-2xl font-medium outline-none"
        />
        <span className="flex shrink-0 items-center gap-1.5">
          {isFrom && isConnected && onPercentClick && (
            <span className="hidden items-center gap-1.5 group-focus-within:flex group-hover:flex">
              {PERCENT_OPTIONS.map(percent => (
                <button
                  key={percent}
                  type="button"
                  onClick={() => onPercentClick(percent)}
                  data-testid={`convert-from-percent-${percent}`}
                  className="bg-panel text-textSecondary hover:text-text rounded-full px-2 py-1 text-xs font-medium transition-colors"
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
