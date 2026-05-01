import { ReadHook } from '../hooks';

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
  /** Display name for the market (e.g. "PT-USDG") */
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
   * The single underlying token accepted by SY.getTokensIn() / getTokensOut().
   * v1 supports only markets where SY accepts exactly one token, so we lock the
   * "tokenIn === tokenMintSy" / "tokenOut === tokenRedeemSy" invariants by config.
   */
  underlyingToken: `0x${string}`;
  /** Display symbol for the underlying token (e.g. "USDG") */
  underlyingSymbol: string;
  /** Underlying token decimals */
  underlyingDecimals: number;
  /** Market expiry as a UNIX timestamp in seconds (immutable post-deploy) */
  expiry: number;
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
  /** Routing fee in USD as reported by the API (undefined if API omits it) */
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
