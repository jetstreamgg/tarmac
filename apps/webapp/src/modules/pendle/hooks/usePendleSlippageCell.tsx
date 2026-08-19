import { useMemo, type ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { formatNumber } from '@/utils';
import { usePendleSlippage, type PendleSlippageMode } from '@/widgets';
import { SlippageMenu } from '@/components/ui/SlippageMenu';

/**
 * The slippage trio every Pendle modal grid draws the same way: the formatted
 * value, the Auto/Custom mode badge, and the inline gear (Figma 2193:73734 —
 * shared trigger styling and the `pendle-slippage-menu` testid). Wraps
 * `usePendleSlippage`, which owns per-flow persistence; `slippage` stays
 * exposed for the quote/write/analytics plumbing.
 */
export function usePendleSlippageCell(mode: PendleSlippageMode): {
  slippage: number;
  slippageDisplay: string;
  slippageMode: string;
  slippageAction: ReactNode;
} {
  const { slippage, setSlippage, defaultSlippage } = usePendleSlippage(mode);
  const slippageAction = useMemo(
    () => (
      <SlippageMenu
        value={slippage}
        defaultValue={defaultSlippage}
        onChange={setSlippage}
        triggerClassName="text-fgTertiary hover:text-fgPrimary data-[state=open]:text-fgPrimary p-0 [&>svg]:size-3.5"
        dataTestId="pendle-slippage-menu"
      />
    ),
    [slippage, defaultSlippage, setSlippage]
  );
  return {
    slippage,
    slippageDisplay: `${formatNumber(slippage * 100, { maxDecimals: 2 })}%`,
    slippageMode: slippage === defaultSlippage ? t`Auto` : t`Custom`,
    slippageAction
  };
}
