import type { ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { formatBigInt, formatUsd } from '@/utils';
import {
  formatPendleAggregatorName,
  getTokenDecimals,
  type PendleConvertQuote,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells, type ModalGridFee } from '@/components/product/ModalGridCells';
import { TokenSelectorPill } from '@/components/product/TokenSelectorPill';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { NO_VALUE } from '@/lib/constants';
import { formatPriceImpact } from '../utils/priceImpact';
import { buildPendleRedeemRows } from './pendleModalRows';

type PendleRedeemProps = {
  market: PendleMarketConfig;
  /** Read-only PT input — full balance, not editable. */
  ptBalance: bigint;
  /** Token list for the Withdrawal-token selector (USDS / USDC). */
  outputTokenList: Token[];
  selectedOutputToken: Token;
  onOutputTokenChange: (token: Token) => void;
  quote?: PendleConvertQuote;
  isFetchingQuote: boolean;
  /** Current slippage, formatted (e.g. "0.50%"). */
  slippageDisplay: string;
  /** Slippage mode badge text — "Auto" at the flow default, "Custom" otherwise. */
  slippageMode: string;
  /** Inline gear opening the slippage menu. */
  slippageAction?: ReactNode;
  /** Network the transaction runs on. */
  network: string;
  /** Chain the engine runs on, for the Network cell's icon. */
  networkChainId?: number;
  /** Live gas estimate for the Network fee cell. */
  feeCell?: ModalGridFee;
};

/**
 * Body of the matured-claim modal: the PT hero over the shared summary
 * grid. No comp exists for this flow — the layout follows the withdraw comps
 * (Figma 2193:73598 / 2193:73807). Slippage, its floor and the route rows
 * show only on aggregator routes; a direct redemption can't slip.
 */
export const PendleRedeem = ({
  market,
  ptBalance,
  outputTokenList,
  selectedOutputToken,
  onOutputTokenChange,
  quote,
  isFetchingQuote,
  slippageDisplay,
  slippageMode,
  slippageAction,
  network,
  networkChainId,
  feeCell
}: PendleRedeemProps) => {
  const ptSymbol = `PT-${market.underlyingSymbol}`;
  const outDecimals = getTokenDecimals(selectedOutputToken, mainnet.id);
  const aggregatorName = quote?.aggregatorType ? formatPendleAggregatorName(quote.aggregatorType) : undefined;
  // Aggregator-ness derives from the token, not the quote: the route row must
  // stay stable while a quote is in flight, and only non-SY-accepted outputs
  // route through one.
  const outputAddress = selectedOutputToken.address[mainnet.id]?.toLowerCase();
  const aggregator = market.syAcceptedTokens
    ? !market.syAcceptedTokens.some(accepted => accepted.toLowerCase() === outputAddress)
    : !!aggregatorName;
  const quoteLoading = isFetchingQuote && !quote;

  const rows = buildPendleRedeemRows({
    tokenSelector: (
      <TokenSelectorPill
        tokens={outputTokenList}
        selected={selectedOutputToken}
        onSelect={onOutputTokenChange}
        testId="pendle-redeem-output-token"
      />
    ),
    receiveAmount: quote ? formatBigInt(quote.amountOut, { unit: outDecimals, maxDecimals: 2 }) : NO_VALUE,
    aggregator,
    quoteLoading,
    slippage: slippageDisplay,
    slippageMode,
    slippageAction,
    // Floored: the contractual minimum must not display optimistically.
    minReceived: quote
      ? formatBigInt(quote.apiMinOut, { unit: outDecimals, maxDecimals: 2, roundingMode: 'floor' })
      : NO_VALUE,
    receiveSymbol: selectedOutputToken.symbol,
    priceImpact: formatPriceImpact(quote?.priceImpact) ?? NO_VALUE,
    routedVia: aggregatorName ? `Pendle redeem → ${aggregatorName}` : NO_VALUE,
    pendleFee: quote?.feeUsd && quote.feeUsd > 0 ? formatUsd(quote.feeUsd) : undefined,
    network,
    networkChainId,
    networkFee: NO_VALUE
  });

  return (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid="pendle-redeem">
      <TransactionAmountHero
        // The PT side on top, as in the early withdrawal; read-only, since a
        // claim always takes the whole balance. Large like the stake claim.
        // Labelled like the card's "My position", not as the payout.
        label={t`Your position`}
        amount={formatBigInt(ptBalance, { unit: market.underlyingDecimals, maxDecimals: 2 })}
        symbol={ptSymbol}
        usd={
          market.usdsEquivalence === 'pegged'
            ? formatUsd(Number(formatUnits(ptBalance, market.underlyingDecimals)))
            : undefined
        }
        size="lg"
        dataTestId="pendle-redeem-hero"
      />

      <ModalSummaryGrid rows={toGridCells(rows, 'pendle-redeem-row', feeCell)} dividerClassName="h-6" />
    </div>
  );
};
