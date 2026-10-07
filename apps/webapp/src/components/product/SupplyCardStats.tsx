import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { formatNumber } from '@/utils';
import { ProductFigure, ProductStat, ProductStatPair } from '@/components/product/ProductCard';
import { NO_VALUE } from '@/lib/constants';

/**
 * The supply cards' "Idle balance" figure: the wallet's supply-token amount to
 * 2 decimals, or `NO_VALUE` while there is nothing to read (disconnected, or
 * the balance not yet loaded).
 */
export function formatIdleBalance(amount: number | undefined): string {
  return amount !== undefined ? formatNumber(amount, { maxDecimals: 2 }) : NO_VALUE;
}

/**
 * The "Current Rate / Idle balance" stat row every no-position supply card
 * carries. `rate` and `idle` are the formatted figures (`NO_VALUE` when
 * unavailable); `rateFigure` is the rate figure's full content (the rate text
 * plus its token mark / info glyph — some cards wrap the text in a tooltip),
 * `idleIcon` is the mark(s) after the idle balance.
 */
export function SupplyCardStats({
  rate,
  rateFigure,
  idle,
  idleIcon
}: {
  rate: string;
  rateFigure: ReactNode;
  idle: string;
  idleIcon: ReactNode;
}) {
  return (
    <ProductStatPair>
      <ProductStat size="lg" label={<Trans>Current Rate</Trans>}>
        <ProductFigure value={rate}>{rateFigure}</ProductFigure>
      </ProductStat>
      <ProductStat size="lg" label={<Trans>Idle balance</Trans>}>
        <ProductFigure value={idle}>
          {idle}
          {idleIcon}
        </ProductFigure>
      </ProductStat>
    </ProductStatPair>
  );
}
