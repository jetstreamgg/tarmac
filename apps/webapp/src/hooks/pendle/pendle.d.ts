import { ReadHook } from '../hooks';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { PendleHistoryAction } from './constants';

/**
 * Configuration for a Pendle market.
 *
 * Each entry pins a specific PT market we support. Adding a new market is a
 * config-only change — no codegen, no on-chain registration. PT addresses live
 * here (not in wagmi codegen) because they rotate every time a market expires.
 *
 * `expiry` is hardcoded because Pendle market expiry is immutable after
 * deployment. We treat the config as the source of truth — no on-chain reads
 * required to determine maturity. Maturity status comes from `isMarketMatured`
 * in helpers.ts.
 */
export type PendleMarketConfig = {
  /** Display name for the market (e.g. "PT-sUSDS") */
  name: string;
  /** The Pendle Market contract address (mainnet) */
  marketAddress: `0x${string}`;
  /** The PT token contract address */
  ptToken: `0x${string}`;
  /** The YT token contract address (paired with PT, used for redeemPyToToken post-maturity) */
  ytToken: `0x${string}`;
  /** The SY (ERC-5115) token contract address */
  syToken: `0x${string}`;
  /**
   * Pendle's "underlyingAsset" — the SY's wrapped yield-bearing token. Used as
   * tokenMintSy / tokenRedeemSy when the user picks a non-direct token and the
   * call routes through the aggregator.
   */
  underlyingToken: `0x${string}`;
  /** Display symbol for the underlying token (e.g. "sUSDS") */
  underlyingSymbol: string;
  /** Underlying token decimals */
  underlyingDecimals: number;
  /**
   * Tokens SY accepts directly via getTokensIn() / getTokensOut() — no aggregator
   * hop. When the user picks one of these, the call sets pendleSwap=0x0 and
   * tokenMintSy=userPicked. Defaults to [underlyingToken] for single-input SYs;
   * set explicitly when SY accepts multiple tokens (PT-sUSDS accepts DAI, USDS,
   * sUSDS).
   */
  syAcceptedTokens?: `0x${string}`[];
  /** Market expiry as a UNIX timestamp in seconds (immutable post-deploy) */
  expiry: number;
  /**
   * How the underlying converts to USDS for earnings display:
   *   - 'pegged'  → 1 underlying ≈ 1 USDS (e.g. PT-sUSDS, where 1 PT pays 1 USDS at maturity)
   *   - 'sUSDS'   → multiply by chi from sUSDS.previewRedeem(1e18)
   *   - undefined → no USDS conversion; display in underlying token symbol
   */
  usdsEquivalence?: 'pegged' | 'sUSDS';
};

/**
 * The /convert quote we feed into usePendleConvert.
 *
 * We never use the API's raw calldata or tx.to — usePendleConvert constructs
 * the call from known values (receiver, market, amounts, slippage) and forces
 * every dangerous field (pendleSwap, swapData, limit) to its empty form. The
 * only API value the call actually depends on is `amountOut` (used to derive
 * minOut) and `apiContractParams[3]` (the `guessPtOut` solver hint, Buy only).
 */
/**
 * Pendle's on-chain SwapData struct (matches `swapData` arg in
 * swapExactTokenForPt / swapExactPtForToken). Populated by the API when an
 * aggregator hop is needed; empty otherwise (see PENDLE_EMPTY_SWAP_DATA).
 */
export type PendleSwapData = {
  /** Pendle's SwapType enum — non-zero indicates an aggregator route */
  swapType: number;
  /** External aggregator router address (KyberSwap, Odos, OKX, Paraswap, …) */
  extRouter: `0x${string}`;
  /** Encoded calldata to forward to the external aggregator */
  extCalldata: `0x${string}`;
  /** Whether output amounts must be scaled (Pendle internal) */
  needScale: boolean;
};

/**
 * Aggregator route returned by /convert when the input/output token differs
 * from the SY's accepted token (i.e. when `enableAggregator: true` is set on
 * the request). buildVerifiedArgs validates `pendleSwap` against
 * PENDLE_PINNED_PENDLESWAP_ADDRESSES before allowing the call.
 */
export type PendleAggregatorRoute = {
  /** MUST equal a Pendle-deployed PendleSwap forwarder; rejected otherwise. */
  pendleSwap: `0x${string}`;
  /** Aggregator forwarding payload */
  swapData: PendleSwapData;
  /**
   * The token the aggregator delivers to SY — `tokenMintSy` for BUY, `tokenRedeemSy`
   * for WITHDRAW/EXIT. Pendle picks the cheapest SY-accepted route, so for
   * multi-input SYs this can be any token in `getTokensIn() / getTokensOut()` and
   * is NOT necessarily the configured `underlyingToken`. buildVerifiedArgs
   * verifies it against `syAcceptedTokens` before signing.
   */
  tokenMintSyOrRedeem: `0x${string}`;
};

/** Pendle's price-impact breakdown — present only when an aggregator hop is in the route. */
export type PendlePriceImpactBreakdown = {
  /** Slippage from Pendle's own AMM (decimal, signed) */
  internalPriceImpact: number;
  /** Slippage from the external aggregator hop (decimal, signed) */
  externalPriceImpact: number;
};

export type PendleConvertQuote = {
  /** Function name as reported by Pendle's contractParamInfo */
  method: string;
  /** Output amount the API computed (in output-token wei) */
  amountOut: bigint;
  /**
   * The API's calculated minimum output (`minPtOut` for Buy, `minTokenOut`
   * nested in `output` for Withdraw). Used directly as the on-chain min
   * tolerance. If a compromised API tampers with this, our other defenses
   * (pinned router, override receiver/market/amounts, force-empty
   * pendleSwap/swapData/limit) still bound the blast radius.
   */
  apiMinOut: bigint;
  /** Effective APY at user's input amount (decimal, e.g. 0.04 = 4%) */
  effectiveApy: number;
  /** Implied APY (market-wide, decimal) */
  impliedApy: number;
  /** Price impact (decimal, signed) */
  priceImpact: number;
  /** Internal/external price-impact split — present only on aggregator routes */
  priceImpactBreakdown?: PendlePriceImpactBreakdown;
  /** Aggregator name as reported by Pendle ("KYBERSWAP", "ODOS", …); display only */
  aggregatorType?: string;
  /**
   * Aggregator forwarding payload — present iff the route uses an aggregator.
   * When present, buildVerifiedArgs takes the aggregator branch:
   * `tokenMintSy`/`tokenRedeemSy` is set to the underlying token (not the
   * user-selected input/output), and `pendleSwap` + `swapData` are forwarded
   * after the pinned-pendleSwap check.
   */
  aggregatorRoute?: PendleAggregatorRoute;
  /**
   * Trade fee in USD as reported by the API. Undocumented beyond `fee.usd`;
   * appears to track Pendle's own swap fee (populated on non-aggregator routes
   * too), but Pendle could fold aggregator-side fees in without notice.
   * Surface as-is.
   */
  feeUsd?: number;
  /** ms epoch when this quote was fetched (for staleness check) */
  fetchedAt: number;
  /**
   * The API's parsed contract args. Each entry corresponds positionally to
   * `apiContractParamsName`. The only entry buildVerifiedArgs reads is the
   * `guessPtOut` struct on Buy quotes; everything else is rebuilt from
   * known values.
   */
  apiContractParams: unknown[];
  /** Names matching `apiContractParams` positionally (e.g. ["receiver","market",...]) */
  apiContractParamsName: string[];
};

/** Hook return type for read hooks that surface a single quote */
export type PendleQuoteHook = ReadHook & {
  data?: PendleConvertQuote;
};

export type PendleMarketStats = {
  /** Implied APY headline (decimal) */
  impliedApy: number;
  /** Total TVL in USD (raw number) */
  tvl?: number;
  /** Total TVL display string (e.g. "$10.5M") */
  formattedTvl?: string;
  /** Underlying APY of the SY (decimal) */
  underlyingApy?: number;
  /** Market expiry as a UNIX timestamp in seconds (matches the on-chain expiry()) */
  expirySec?: number;
  /** Market deployment timestamp in seconds (start of the maturity window) */
  startTimestampSec?: number;
};

/**
 * Per-market stats keyed by `marketAddress` exactly as it appears in
 * PENDLE_MARKETS. Markets the API didn't return (e.g. misconfigured) are absent.
 */
export type PendleMarketsStats = Record<`0x${string}`, PendleMarketStats>;

export type PendleMarketsStatsHook = ReadHook & {
  data?: PendleMarketsStats;
};

/**
 * Per-market user PT balance, keyed by `marketAddress` as it appears in
 * PENDLE_MARKETS. Markets the user does not hold are present with `0n`.
 */
export type PendleUserPtBalances = Record<`0x${string}`, bigint>;

export type PendleUserPtBalancesHook = ReadHook & {
  data?: PendleUserPtBalances;
};

// ---------------------------------------------------------------------------
// Pendle API transport types (/convert and /v2/markets/all)
// ---------------------------------------------------------------------------

export type PendleConvertRequest = {
  receiver: `0x${string}`;
  /** Decimal: 0.002 = 0.2% */
  slippage: number;
  inputs: Array<{ token: `0x${string}`; amount: string }>;
  outputs: Array<`0x${string}`>;
  additionalData?: string;
  /**
   * When true, Pendle's API may return a route that uses an external
   * aggregator (KyberSwap, Odos, …) in front of / behind the SY conversion.
   * Set only when the user-selected input/output token differs from the
   * market's underlying token.
   */
  enableAggregator?: boolean;
};

/**
 * The relevant fields we care about from /convert. Pendle returns a richer
 * response with several routes; we always read `routes[0]` (the recommended
 * route) and pluck what we need.
 */
export type PendleConvertRouteRaw = {
  contractParamInfo: {
    method: string;
    contractCallParamsName: string[];
    contractCallParams: unknown[];
  };
  tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    from: `0x${string}`;
  };
  outputs: Array<{ token: `0x${string}`; amount: string }>;
  data: {
    aggregatorType: string;
    priceImpact: number;
    /** Present only on aggregator routes (when enableAggregator was true and a hop was needed). */
    priceImpactBreakDown?: {
      internalPriceImpact: number;
      externalPriceImpact: number;
    };
    impliedApy?: { before: number; after: number };
    effectiveApy?: number;
    fee?: { usd: number };
  };
};

export type PendleConvertResponseRaw = {
  action: string;
  inputs: Array<{ token: `0x${string}`; amount: string }>;
  requiredApprovals: Array<{ token: `0x${string}`; amount: string }>;
  routes: PendleConvertRouteRaw[];
};

/**
 * Per-market detail bag returned under `details`. Only the fields we actually
 * use are typed; the API includes many more (swapFeeApy, pendleApy,
 * ytFloatingApy, yieldRange, etc.) — add them here as needed.
 */
export type PendleMarketDetailsRaw = {
  liquidity?: number;
  totalTvl?: number;
  tradingVolume?: number;
  underlyingApy?: number;
  impliedApy?: number;
  swapFeeApy?: number;
};

/**
 * One entry in the `results` array. References to other tokens come back as
 * "<chainId>-<address>" strings (e.g. "1-0xb87511..."). `expiry` is an ISO
 * timestamp string.
 */
export type PendleMarketSummaryRaw = {
  name: string;
  address: `0x${string}`;
  expiry: string;
  pt: string;
  yt: string;
  sy: string;
  underlyingAsset: string;
  accountingAsset?: string;
  chainId: number;
  details: PendleMarketDetailsRaw;
  isNew?: boolean;
  isPrime?: boolean;
  timestamp?: string;
  categoryIds?: string[];
  isVolatile?: boolean;
};

export type PendleMarketsAllResponseRaw = {
  total: number;
  limit: number;
  skip: number;
  results: PendleMarketSummaryRaw[];
};

// ---------------------------------------------------------------------------
// Pendle API transport types (/v1/pnl/transactions)
// ---------------------------------------------------------------------------

/**
 * One entry in /v1/pnl/transactions `results`. The endpoint covers every
 * PnL-affecting action (mintPy, buyPt, sellPt, redeemPy, swapPtToYt, …) and
 * is unfiltered by market — callers narrow to PENDLE_MARKETS and the actions
 * we surface (buyPt, sellPt, redeemPy). `action` stays a free string so
 * unknown values pass through untouched and get filtered client-side.
 *
 * `market` comes back as a raw address ("0xc5b32…") on this endpoint —
 * other Pendle endpoints prefix it with "<chainId>-", so the resolver in
 * usePendleAllPnlTransactions accepts both forms when looking up
 * PENDLE_MARKETS.
 *
 * `txValueAsset` is the magnitude of the underlying-token movement caused
 * by this transaction (positive on both spend and receive sides — sign is
 * implied by the action). Zero on YT-only redeems where no underlying
 * actually moved.
 *
 * `effectivePtExchangeRate` is the PT-per-underlying rate the trade executed
 * at. Multiplying `txValueAsset * effectivePtExchangeRate` reproduces v5's
 * `notional.pt` for buyPt/sellPt rows (verified against a live wallet).
 *
 * `assetUsd` is the underlying token's USD price at trade time;
 * `txValueAsset * assetUsd` yields the USD-denominated trade value.
 *
 * Fields not consumed (ptData/ytData/lpData, profit, priceInAsset) are
 * intentionally omitted — the wire shape diverges from Pendle's OpenAPI
 * for ptData.unit (claimed delta, actually a running balance / 0 / per-tx
 * delta depending on action), and leaving them off keeps us from being
 * tempted to read unreliable values.
 */
export type PendlePnlTransactionRaw = {
  chainId: number;
  market: string;
  timestamp: string;
  action: string;
  txHash: `0x${string}`;
  txValueAsset: number;
  assetUsd: number;
  effectivePtExchangeRate: number;
};

export type PendlePnlTransactionsResponseRaw = {
  total: number;
  results: PendlePnlTransactionRaw[];
};

/**
 * Normalized history row exposed to the UI and to computeMaturedEarnings.
 * All rows originate from /v1/pnl/transactions and are discriminated by
 * `action` after the transport boundary maps wire values (buyPt/sellPt/
 * redeemPy) to the canonical PendleHistoryAction enum.
 *
 * `valueUsd` is USD-denominated (txValueAsset × assetUsd) for every row.
 * computeMaturedEarnings filters by action before consuming `valueUsd`, so
 * redeem rows don't contribute to cost basis even though they carry a value.
 */
export type PendleHistoryRow = {
  /** `${txHash}:${action}` — the PnL feed has no id of its own, and the
   * action discriminates the rare multi-action tx (e.g. buy + sell in one zap). */
  id: string;
  txHash: `0x${string}`;
  timestamp: string;
  action: PendleHistoryAction;
  /**
   * PT amount this transaction acted on, in PT units.
   *   - Trades (BUY_PT/SELL_PT): `txValueAsset * effectivePtExchangeRate`,
   *     verified to match v5's `notional.pt` to ≥4 decimals across a real
   *     wallet's history.
   *   - Redeems (REDEEM_PY): `txValueAsset` (1 PT ≈ 1 underlying at
   *     redemption — the underlying received equals the PT redeemed).
   */
  ptAmount: number;
  /** USD-denominated trade value (txValueAsset × assetUsd from the PnL feed). */
  valueUsd: number;
};

export type PendleMarketHistoryHook = ReadHook & {
  data?: PendleHistoryRow[];
};

/**
 * Normalized history row tagged with its source market. Returned by
 * useAllPendleMarketsHistory, which merges per-market feeds across every
 * entry in PENDLE_MARKETS so the overview can show activity for matured
 * markets the user can no longer click into.
 */
export type PendleCombinedHistoryRow = PendleHistoryRow & {
  market: PendleMarketConfig;
};

export type PendleCombinedMarketHistoryHook = ReadHook & {
  data?: PendleCombinedHistoryRow[];
};

/**
 * Adapter shape for the cross-module combined history used by the user
 * activity modal. Mirrors the field set the BalancesHistoryItem renderer
 * expects (blockTimestamp/transactionHash/module/type/chainId) and carries
 * the Pendle-specific bits the display helpers consume.
 *
 * `ptAmount` is the raw PT integer (PT decimals = underlying decimals per
 * Pendle convention), so `formatBigInt(amount, { unit: decimals })` renders
 * the same number a user would see on a block explorer or the per-market
 * history table. `marketName` ("PT-sUSDS", …) is the unit shown in the row's
 * right-hand text.
 */
export interface PendleHistoryItem {
  blockTimestamp: Date;
  transactionHash: string;
  module: ModuleEnum.PENDLE;
  type: TransactionTypeEnum.PENDLE_BUY | TransactionTypeEnum.PENDLE_SELL | TransactionTypeEnum.PENDLE_REDEEM;
  /** Always mainnet — Pendle's API doesn't serve other chains we support. */
  chainId: 1;
  /**
   * Underlying-token amount the user spent (BUY) or received (SELL/REDEEM),
   * in the underlying's native decimals. Naming matches the `assets` field on
   * Savings/Morpho rows so getAmount can read it via the same `'assets' in
   * item` discriminator.
   */
  assets: bigint;
  /** Underlying-token decimals — used by formatBigInt at render time. */
  underlyingDecimals: number;
  /** Underlying-token display symbol (e.g. "sUSDS"). */
  underlyingSymbol: string;
  /** Market name for breadcrumb context; not used in the row's right-hand unit. */
  marketName: string;
  /** Source market address — useful for downstream linking; not currently rendered. */
  marketAddress: `0x${string}`;
}

export type PendleHistoryHook = ReadHook & {
  data?: PendleHistoryItem[];
};

/** Per-market user PT balance + USD valuation, scoped to markets we support. */
export type PendleMarketUserAsset = {
  /** Market contract address */
  marketAddress: `0x${string}`;
  /** User's PT balance in the PT's native decimals (== underlying decimals) */
  ptBalance: bigint;
  /** User's PT balance normalized to 18 decimals (WAD) */
  ptBalanceNormalized: bigint;
  /** USD valuation of the PT position (USDS-equivalent peg × USDS price) */
  valuationUsd: number;
};

export type AllPendleUserAssetsData = {
  /** Total PT balance across all supported markets, normalized to 18 decimals (WAD) */
  total: bigint;
  /** Sum of per-market USD valuations across all supported markets */
  totalUsd: number;
  /** Per-market breakdown — only includes markets we support with a non-zero PT balance */
  markets: PendleMarketUserAsset[];
};

export type AllPendleUserAssetsHook = ReadHook & {
  data: AllPendleUserAssetsData;
};
