import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { BP, useBreakpointIndex } from '@/hooks';
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
 * One side of the Convert card (Figma 1036:205437, which supersedes the
 * 486:31204/486:31210 frames this was built from): a translucent glass panel
 * of two rows — the side label with the balance right-aligned beside it, then
 * the large amount with the 25/50/100% shortcuts and the token chip to its
 * right. The origin side is editable; the target side is display-only (the PSM
 * rate is fixed, so the amount is always derived).
 *
 * The redraw moved the balance up from the meta row and retired the USD line
 * the meta row carried — the comp has no second figure, and with both PSM
 * tokens being USD stablecoins on a fee-free 1:1 swap it only ever restated the
 * amount. The "0.00" placeholder keeps the primary text colour per the comp's
 * default frame (fg-primary, not the muted secondary).
 *
 * Phone tier (comps 1295:24298/25268, M6.9): 16px panel padding, a smaller
 * amount, and — because three chips plus the token chip cannot share a 360px
 * row with a typed figure — the percent chips still yield once an amount is
 * entered.
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
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const isFrom = side === 'from';

  const percentButtons = isFrom && isConnected && onPercentClick && (
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
  );

  return (
    <div
      className="bg-glassSurface flex flex-col gap-2 p-4 backdrop-blur-[20px] md:gap-[9px] md:px-8 md:py-7"
      data-testid={`convert-${side}`}
    >
      {/* Body 5 meta row: side label left, balance right (1036:205449). */}
      <div className="flex items-center justify-between gap-2">
        <Text className="text-fgSecondary text-xs md:text-sm md:leading-[22px]">
          {isFrom ? <Trans>From</Trans> : <Trans>To</Trans>}
        </Text>
        <Text
          className="text-fgSecondary text-xs md:text-sm md:leading-[22px]"
          dataTestId={`convert-${side}-balance`}
        >
          <Trans>Balance</Trans>: {isConnected ? formatBalance(balance, decimals) : NO_VALUE}
        </Text>
      </div>
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
          className="text-text placeholder:text-text font-circle w-full min-w-0 bg-transparent text-2xl leading-[26px] font-medium tracking-[-0.48px] outline-none md:text-[32px] md:leading-[35px] md:tracking-[-0.64px]"
        />
        <span className="flex shrink-0 items-center gap-1.5">
          {(!isMobile || value === '') && percentButtons}
          <ConvertTokenSelect value={symbol} onChange={onTokenChange} dataTestId={`convert-${side}-token`} />
        </span>
      </div>
    </div>
  );
}
