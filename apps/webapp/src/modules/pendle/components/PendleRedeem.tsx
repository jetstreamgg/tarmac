import type { ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { mainnet } from 'viem/chains';
import { formatBigInt, formatNumber } from '@/utils';
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
  /** Token list for the Claim-token selector (underlying / USDS / USDC). */
  outputTokenList: Token[];
  selectedOutputToken: Token;
  onOutputTokenChange: (token: Token) => void;
  quote?: PendleConvertQuote;
  isFetchingQuote: boolean;
  /** Current slippage, formatted (e.g. "0.50%"). */
  slippageDisplay: string;
  /** Slippage mode badge text — "Auto" at the flow default, "Custom" otherwise. */
  slippageMode: string;
  /** Inline gear opening the slippage menu — drawn only on aggregator routes. */
  slippageAction?: ReactNode;
  /** Network the transaction runs on. */
  network: string;
  /** Chain the engine runs on, for the Network cell's icon. */
  networkChainId?: number;
  /** Live gas estimate for the Network fee cell. */
  feeCell?: ModalGridFee;
  /** User-friendly inline-banner copy for prepare/verify failures. */
  prepareErrorMessage?: string;
};

/**
 * Body of the matured-claim modal: the receive hero over the shared summary
 * grid. No comp exists for this flow — the layout follows the withdraw comps
 * (Figma 2193:73598 / 2193:73807). Slippage/price-impact cells appear only on
 * aggregator routes; a pure PT burn at the SY's expiry-frozen rate has no
 * swap math.
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
  feeCell,
  prepareErrorMessage
}: PendleRedeemProps) => {
  const ptSymbol = `PT-${market.underlyingSymbol}`;
  const outDecimals = getTokenDecimals(selectedOutputToken, mainnet.id);
  const aggregatorName = quote?.aggregatorType ? formatPendleAggregatorName(quote.aggregatorType) : undefined;
  // Aggregator-ness derives from the token, not the quote: the slippage gear
  // must stay reachable while no quote resolves (a too-tight tolerance can be
  // the reason it doesn't), and only non-SY-accepted outputs route through one.
  const outputAddress = selectedOutputToken.address[mainnet.id]?.toLowerCase();
  const aggregator = market.syAcceptedTokens
    ? !market.syAcceptedTokens.some(accepted => accepted.toLowerCase() === outputAddress)
    : !!aggregatorName;
  const quoteLoading = isFetchingQuote && !quote;

  const rows = buildPendleRedeemRows({
    product: `Pendle ${market.underlyingSymbol} (${ptSymbol})`,
    productSymbol: market.underlyingSymbol,
    claimAmount: formatBigInt(ptBalance, { unit: market.underlyingDecimals, maxDecimals: 2 }),
    ptSymbol,
    tokenSelector: (
      <TokenSelectorPill
        tokens={outputTokenList}
        selected={selectedOutputToken}
        onSelect={onOutputTokenChange}
        testId="pendle-redeem-output-token"
      />
    ),
    aggregator,
    quoteLoading,
    slippage: slippageDisplay,
    slippageMode,
    slippageAction,
    minReceived: quote ? formatBigInt(quote.apiMinOut, { unit: outDecimals, maxDecimals: 2 }) : NO_VALUE,
    receiveSymbol: selectedOutputToken.symbol,
    priceImpact: formatPriceImpact(quote?.priceImpact) ?? NO_VALUE,
    routedVia: aggregatorName ? `Pendle redeem → ${aggregatorName}` : NO_VALUE,
    pendleFee:
      quote?.feeUsd !== undefined
        ? `$${formatNumber(quote.feeUsd, { maxDecimals: quote.feeUsd >= 1 ? 2 : 4 })}`
        : t`Included in quote`,
    network,
    networkChainId,
    networkFee: NO_VALUE
  });

  return (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid="pendle-redeem">
      <TransactionAmountHero
        label={t`You'll claim`}
        amount={quote ? formatBigInt(quote.amountOut, { unit: outDecimals, maxDecimals: 2 }) : NO_VALUE}
        symbol={selectedOutputToken.symbol}
        loading={quoteLoading}
        dataTestId="pendle-redeem-hero"
      />

      <ModalSummaryGrid rows={toGridCells(rows, 'pendle-redeem-row', feeCell)} dividerClassName="h-6" />

      {prepareErrorMessage && (
        <div
          className="bg-error/10 text-error rounded-xl px-3 py-2 text-sm"
          data-testid="pendle-redeem-prepare-error"
          role="alert"
        >
          {prepareErrorMessage}
        </div>
      )}
    </div>
  );
};
