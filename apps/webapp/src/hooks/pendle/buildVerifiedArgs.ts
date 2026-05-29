import { isAddressEqual } from 'viem';
import { ZERO_ADDRESS } from '../constants';
import {
  PENDLE_ALLOWED_SELECTORS,
  PENDLE_EMPTY_LIMIT,
  PENDLE_EMPTY_SWAP_DATA,
  PendleConvertSide
} from './constants';
import type { PendleAggregatorRoute, PendleConvertQuote } from './pendle';

// ---------------------------------------------------------------------------
// Verified-args output (typed for the ABI)
// ---------------------------------------------------------------------------

/**
 * The on-chain swapData struct shape. When no aggregator is used this is
 * byte-equivalent to PENDLE_EMPTY_SWAP_DATA; when an aggregator hop is taken
 * (the user-side token is not one the SY accepts directly), the fields come
 * from the API after passing the pinned-pendleSwap check.
 */
type VerifiedSwapData = {
  swapType: number;
  extRouter: `0x${string}`;
  extCalldata: `0x${string}`;
  needScale: boolean;
};
type VerifiedLimit = {
  limitRouter: `0x${string}`;
  epsSkipMarket: bigint;
  normalFills: readonly never[];
  flashFills: readonly never[];
  optData: `0x${string}`;
};

export type VerifiedBuyArgs = readonly [
  receiver: `0x${string}`,
  market: `0x${string}`,
  minPtOut: bigint,
  guessPtOut: {
    guessMin: bigint;
    guessMax: bigint;
    guessOffchain: bigint;
    maxIteration: bigint;
    eps: bigint;
  },
  input: {
    tokenIn: `0x${string}`;
    netTokenIn: bigint;
    tokenMintSy: `0x${string}`;
    pendleSwap: `0x${string}`;
    swapData: VerifiedSwapData;
  },
  limit: VerifiedLimit
];

export type VerifiedWithdrawArgs = readonly [
  receiver: `0x${string}`,
  market: `0x${string}`,
  exactPtIn: bigint,
  output: {
    tokenOut: `0x${string}`;
    minTokenOut: bigint;
    tokenRedeemSy: `0x${string}`;
    pendleSwap: `0x${string}`;
    swapData: VerifiedSwapData;
  },
  limit: VerifiedLimit
];

/**
 * Args for `exitPostExpToToken` — used to redeem PT after market expiry.
 * Always passes `netLpIn = 0n` since we do not expose LP. No `limit`
 * parameter; this method does not support limit orders.
 *
 * Output token may be the underlying (no-aggregator: empty pendleSwap /
 * swapData) or USDS / USDC (aggregator: pinned PendleSwap + populated
 * swapData routed through KyberSwap / Odos / OKX / Paraswap). Selection
 * happens upstream via the user's output-token choice in the redeem UI.
 */
export type VerifiedExitArgs = readonly [
  receiver: `0x${string}`,
  market: `0x${string}`,
  netPtIn: bigint,
  netLpIn: bigint,
  output: {
    tokenOut: `0x${string}`;
    minTokenOut: bigint;
    tokenRedeemSy: `0x${string}`;
    pendleSwap: `0x${string}`;
    swapData: VerifiedSwapData;
  }
];

export type VerifiedCall =
  | { side: PendleConvertSide.BUY; functionName: 'swapExactTokenForPt'; args: VerifiedBuyArgs }
  | {
      side: PendleConvertSide.WITHDRAW;
      functionName: 'swapExactPtForToken';
      args: VerifiedWithdrawArgs;
    }
  | {
      side: PendleConvertSide.WITHDRAW;
      functionName: 'exitPostExpToToken';
      args: VerifiedExitArgs;
    };

// ---------------------------------------------------------------------------
// Caller-supplied known values
// ---------------------------------------------------------------------------

export type KnownCallValues = {
  side: PendleConvertSide;
  receiver: `0x${string}`;
  market: `0x${string}`;
  /** For BUY: user-selected input token. For WITHDRAW: PT token. */
  inputToken: `0x${string}`;
  /** For BUY: PT token. For WITHDRAW: user-selected output token. */
  outputToken: `0x${string}`;
  /**
   * Pendle's underlyingAsset — the SY's wrapped yield-bearing token. Used as
   * tokenMintSy / tokenRedeemSy on the aggregator path.
   */
  underlyingToken: `0x${string}`;
  /**
   * Tokens SY accepts directly via getTokensIn() / getTokensOut(). When the
   * user-side token is in this list, the no-aggregator path is taken
   * (pendleSwap=0x0, tokenMintSy=userSideToken). Optional; defaults to
   * `[underlyingToken]` to match single-input SYs.
   */
  syAcceptedTokens?: `0x${string}`[];
  amountIn: bigint;
  /**
   * The pinned PendleSwap forwarder address for the active chain. The caller
   * resolves this from `PENDLE_PINNED_PENDLESWAP_ADDRESSES[chainId]`. When an
   * aggregator route is taken, the API's `pendleSwap` MUST equal this — any
   * other address is rejected.
   */
  pinnedPendleSwap: `0x${string}`;
  /** Decimal (0.002 = 0.2%). Used to floor apiMinOut — see verifyApiMinOut. */
  slippage: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const verifiedEmptySwapData: VerifiedSwapData = PENDLE_EMPTY_SWAP_DATA;
const verifiedEmptyLimit: VerifiedLimit = PENDLE_EMPTY_LIMIT;

/**
 * Resolve the (pendleSwap, swapData, tokenMintSyOrRedeem) triplet for a Buy
 * or Withdraw call. There are exactly two valid cases:
 *
 *   1. **No aggregator** — the user-picked side is one of the tokens SY accepts
 *      directly (`syAcceptedTokens`). pendleSwap is forced to 0x0 and swapData
 *      to its empty form. tokenMintSy / tokenRedeemSy = the user-picked token
 *      (the SY handles it natively).
 *
 *   2. **Aggregator** — the user picked a token outside `syAcceptedTokens`
 *      (e.g. USDC for a USDS/sUSDS-only SY). The route must pass through
 *      Pendle's PendleSwap forwarder, which proxies to the external aggregator.
 *      We assert the API's `pendleSwap` equals our pinned address; otherwise
 *      we refuse to sign. tokenMintSy / tokenRedeemSy is the underlying —
 *      that's what the SY ends up holding after the aggregator hop.
 *
 * @param userSideToken inputToken on BUY, outputToken on WITHDRAW
 */
function resolveAggregatorFields(
  userSideToken: `0x${string}`,
  underlyingToken: `0x${string}`,
  syAcceptedTokens: `0x${string}`[],
  pinnedPendleSwap: `0x${string}`,
  aggregatorRoute: PendleAggregatorRoute | undefined,
  side: PendleConvertSide
): {
  pendleSwap: `0x${string}`;
  swapData: VerifiedSwapData;
  tokenMintSyOrRedeem: `0x${string}`;
} {
  const usesAggregator = !syAcceptedTokens.some(t => isAddressEqual(userSideToken, t));

  // No aggregator: SY accepts userSideToken directly per getTokensIn/getTokensOut,
  // so tokenMintSy/tokenRedeemSy is the user-picked token itself.
  if (!usesAggregator) {
    return {
      pendleSwap: ZERO_ADDRESS,
      swapData: verifiedEmptySwapData,
      tokenMintSyOrRedeem: userSideToken
    };
  }

  // Aggregator path — require the API to have returned a route.
  if (!aggregatorRoute) {
    throw new Error(
      `Pendle: refusing to sign — aggregator required (${side} with non-SY-accepted token) but the quote has no aggregatorRoute`
    );
  }
  // Trust anchor #1: pendleSwap MUST be the pinned PendleSwap forwarder.
  // Anything else means the API is steering us at an unaudited contract.
  if (!isAddressEqual(aggregatorRoute.pendleSwap, pinnedPendleSwap)) {
    throw new Error(
      `Pendle: refusing to sign — pendleSwap "${aggregatorRoute.pendleSwap}" is not the pinned forwarder "${pinnedPendleSwap}"`
    );
  }
  // Trust anchor #2: the aggregator's delivery token MUST be in our local
  // allowlist of SY-accepted tokens. For multi-input SYs (PT-sUSDS) the API
  // picks the cheapest route, so this isn't necessarily `underlyingToken` —
  // but it must be one of the tokens the SY natively accepts.
  if (!syAcceptedTokens.some(t => isAddressEqual(aggregatorRoute.tokenMintSyOrRedeem, t))) {
    throw new Error(
      `Pendle: refusing to sign — aggregator delivers to "${aggregatorRoute.tokenMintSyOrRedeem}" which is not in syAcceptedTokens`
    );
  }
  return {
    pendleSwap: aggregatorRoute.pendleSwap,
    swapData: aggregatorRoute.swapData,
    tokenMintSyOrRedeem: aggregatorRoute.tokenMintSyOrRedeem
  };
}

/**
 * Floor apiMinOut against `amountOut * (1 - slippage)` so a tampered /convert
 * response can't sneak a too-low minOut into the signed call. Slippage is
 * re-validated here too — localStorage can be widened past the UI cap.
 * 1 bp tolerance absorbs honest API/local rounding drift.
 */
function verifyApiMinOut(quote: PendleConvertQuote, slippage: number): void {
  if (!Number.isFinite(slippage) || slippage < 0 || slippage >= 1) {
    throw new Error(
      `Pendle: refusing to sign — slippage ${slippage} is outside the allowed [0, 1) range`
    );
  }
  const slippageBp = BigInt(Math.round(slippage * 10_000));
  const TOLERANCE_BP = 1n;
  const floorBp = 10_000n - slippageBp - TOLERANCE_BP;
  if (floorBp <= 0n) return;
  const expectedMinOut = (quote.amountOut * floorBp) / 10_000n;
  if (quote.apiMinOut < expectedMinOut) {
    throw new Error(
      `Pendle: refusing to sign — apiMinOut ${quote.apiMinOut} is below the local slippage floor ${expectedMinOut} (amountOut=${quote.amountOut}, slippage=${slippage})`
    );
  }
}

/**
 * Solver hint at position 3. Passed through verbatim — fund safety comes
 * from the verifyApiMinOut floor on minPtOut, not from these hints.
 */
function extractGuessPtOut(params: unknown[]): VerifiedBuyArgs[3] {
  const raw = params[3] as
    | undefined
    | {
        guessMin?: string;
        guessMax?: string;
        guessOffchain?: string;
        maxIteration?: string;
        eps?: string;
      };
  if (!raw || typeof raw !== 'object') {
    throw new Error(
      'Pendle: refusing to sign — malformed quote: apiContractParams[3] (guessPtOut) missing or not an object'
    );
  }
  try {
    return {
      guessMin: BigInt(raw.guessMin ?? 0),
      guessMax: BigInt(raw.guessMax ?? 0),
      guessOffchain: BigInt(raw.guessOffchain ?? 0),
      maxIteration: BigInt(raw.maxIteration ?? 0),
      eps: BigInt(raw.eps ?? 0)
    };
  } catch {
    throw new Error(
      'Pendle: refusing to sign — malformed quote: apiContractParams[3] (guessPtOut) has non-numeric fields'
    );
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Verify a Pendle /convert quote and rebuild the call args we will actually
 * sign. The pipeline:
 *
 *   1. Per-flow selector allowlist (`quote.method` ∈ allowed selectors)
 *   2. Override every user-controllable field with values WE know
 *      (receiver, market, amounts, minOut)
 *   3. Resolve (pendleSwap, swapData, tokenMintSy/tokenRedeemSy) based on
 *      whether the user-picked token is one SY accepts directly
 *      (`syAcceptedTokens`):
 *        - Accepted → no-aggregator: empty pendleSwap/swapData, SY field = user
 *          token (byte-equivalent to `createTokenInputStruct + emptyLimit`).
 *        - Not accepted → aggregator: pendleSwap from the API after a strict
 *          equality check against PENDLE_PINNED_PENDLESWAP_ADDRESSES; swapData
 *          forwarded; SY field = the API's delivery token, checked against
 *          syAcceptedTokens.
 *   4. `limit` is always forced to its empty form — limit-orders are out of
 *      scope.
 *
 * The pinned-router guard is enforced upstream by usePendleConvert which
 * always submits to PENDLE_ROUTER_V4_ADDRESS — never to `quote.tx.to`.
 *
 * Trust anchors of the aggregator branch:
 *   (a) pendleSwap is pinned (only Pendle's audited forwarder),
 *   (b) tokenMintSy/tokenRedeemSy must be in syAcceptedTokens (the SY's
 *       allowlist of directly-accepted tokens),
 *   (c) apiMinOut is floored against `amountOut * (1 - slippage)` so a
 *       compromised or buggy quote cannot sneak a too-low minOut into the
 *       signed calldata — see verifyApiMinOut.
 */
export function buildVerifiedArgs(quote: PendleConvertQuote, known: KnownCallValues): VerifiedCall {
  // 1. Per-flow allowlist
  const allowed = (
    known.side === PendleConvertSide.BUY ? PENDLE_ALLOWED_SELECTORS.buy : PENDLE_ALLOWED_SELECTORS.withdraw
  ) as readonly string[];
  if (!allowed.includes(quote.method)) {
    throw new Error(`Pendle: refusing to sign — selector "${quote.method}" not allowed for ${known.side}`);
  }

  // 2. apiMinOut floor — uniform across buy / withdraw / exit.
  verifyApiMinOut(quote, known.slippage);

  // 3 + 4. Rebuild args from known values + force-empty.
  // Dispatch on the API's method (already gated by the allowlist above).
  if (quote.method === 'swapExactTokenForPt') {
    return buildBuyArgs(quote, known);
  }
  if (quote.method === 'swapExactPtForToken') {
    return buildWithdrawArgs(quote, known);
  }
  if (quote.method === 'exitPostExpToToken') {
    return buildExitArgs(quote, known);
  }
  // Unreachable: the allowlist check would have thrown above.
  throw new Error(`Pendle: unreachable — selector "${quote.method}" has no verified-args builder`);
}

// ---------------------------------------------------------------------------
// Buy: swapExactTokenForPt(receiver, market, minPtOut, guessPtOut, input, limit)
// ---------------------------------------------------------------------------

function buildBuyArgs(quote: PendleConvertQuote, known: KnownCallValues): VerifiedCall {
  const guessPtOut = extractGuessPtOut(quote.apiContractParams);
  const { pendleSwap, swapData, tokenMintSyOrRedeem } = resolveAggregatorFields(
    known.inputToken, // BUY's user-picked side is the input
    known.underlyingToken,
    known.syAcceptedTokens ?? [known.underlyingToken],
    known.pinnedPendleSwap,
    quote.aggregatorRoute,
    PendleConvertSide.BUY
  );

  const args: VerifiedBuyArgs = [
    known.receiver,
    known.market,
    quote.apiMinOut,
    guessPtOut,
    {
      tokenIn: known.inputToken,
      netTokenIn: known.amountIn,
      tokenMintSy: tokenMintSyOrRedeem,
      pendleSwap,
      swapData
    },
    verifiedEmptyLimit
  ] as const;

  return { side: PendleConvertSide.BUY, functionName: 'swapExactTokenForPt', args };
}

// ---------------------------------------------------------------------------
// Withdraw: swapExactPtForToken(receiver, market, exactPtIn, output, limit)
// ---------------------------------------------------------------------------

function buildWithdrawArgs(quote: PendleConvertQuote, known: KnownCallValues): VerifiedCall {
  const { pendleSwap, swapData, tokenMintSyOrRedeem } = resolveAggregatorFields(
    known.outputToken, // WITHDRAW's user-picked side is the output
    known.underlyingToken,
    known.syAcceptedTokens ?? [known.underlyingToken],
    known.pinnedPendleSwap,
    quote.aggregatorRoute,
    PendleConvertSide.WITHDRAW
  );

  const args: VerifiedWithdrawArgs = [
    known.receiver,
    known.market,
    known.amountIn,
    {
      tokenOut: known.outputToken,
      minTokenOut: quote.apiMinOut,
      tokenRedeemSy: tokenMintSyOrRedeem,
      pendleSwap,
      swapData
    },
    verifiedEmptyLimit
  ] as const;

  return { side: PendleConvertSide.WITHDRAW, functionName: 'swapExactPtForToken', args };
}

// ---------------------------------------------------------------------------
// Exit: exitPostExpToToken(receiver, market, netPtIn, netLpIn, output)
// ---------------------------------------------------------------------------

function buildExitArgs(quote: PendleConvertQuote, known: KnownCallValues): VerifiedCall {
  const { pendleSwap, swapData, tokenMintSyOrRedeem } = resolveAggregatorFields(
    known.outputToken, // EXIT's user-picked side is the output, same as WITHDRAW
    known.underlyingToken,
    known.syAcceptedTokens ?? [known.underlyingToken],
    known.pinnedPendleSwap,
    quote.aggregatorRoute,
    PendleConvertSide.WITHDRAW
  );

  const args: VerifiedExitArgs = [
    known.receiver,
    known.market,
    known.amountIn,
    0n, // netLpIn — v1 does not expose LP
    {
      tokenOut: known.outputToken,
      minTokenOut: quote.apiMinOut,
      tokenRedeemSy: tokenMintSyOrRedeem,
      pendleSwap,
      swapData
    }
  ] as const;

  return { side: PendleConvertSide.WITHDRAW, functionName: 'exitPostExpToToken', args };
}

// ---------------------------------------------------------------------------
// Matured redeem (quote-less) — produces a VerifiedExitArgs without an API
// call. Post-expiry redemption is contractually 1:1 (PT → SY → underlying),
// so we don't need the API to compute amountOut or guess hints. We construct
// the same struct buildVerifiedArgs would produce for an exit, with
// `minTokenOut = 0n` (the redeem path is deterministic — no slippage).
// ---------------------------------------------------------------------------

export type MaturedRedeemContext = {
  receiver: `0x${string}`;
  market: `0x${string}`;
  /** PT token address — the input being burned for redemption */
  ptToken: `0x${string}`;
  /** Underlying asset to receive — must match `tokenRedeemSy` of the SY */
  underlyingToken: `0x${string}`;
  /** PT amount to redeem (raw wei) */
  amountIn: bigint;
};

/**
 * Build a verified `exitPostExpToToken` call without an API quote. Use only
 * for matured markets. Output struct is byte-equivalent to what
 * buildVerifiedArgs() produces for the exit path with apiMinOut = 0.
 *
 * Why no quote: the exit path is deterministic post-expiry — the contract
 * burns PT 1:1 for SY then redeems SY for the underlying at the configured
 * rate. There's no slippage, no aggregator routing, no price impact. The
 * API would just confirm what we already know.
 *
 * Pinning context: this still respects the no-aggregator invariant
 * (`pendleSwap = 0`, empty `swapData`) and the locked-router invariant
 * (caller submits to PENDLE_ROUTER_V4_ADDRESS, never anything else).
 */
export function buildMaturedRedeemVerifiedArgs(ctx: MaturedRedeemContext): VerifiedCall & {
  functionName: 'exitPostExpToToken';
} {
  if (ctx.amountIn === 0n) {
    throw new Error('Pendle: refusing to build redeem args — amountIn is zero');
  }
  const args: VerifiedExitArgs = [
    ctx.receiver,
    ctx.market,
    ctx.amountIn,
    0n, // netLpIn — v1 does not expose LP
    {
      tokenOut: ctx.underlyingToken,
      minTokenOut: 0n, // matured redeem is deterministic 1:1, no slippage
      tokenRedeemSy: ctx.underlyingToken, // no-aggregator invariant
      pendleSwap: ZERO_ADDRESS,
      swapData: verifiedEmptySwapData
    }
  ] as const;

  return { side: PendleConvertSide.WITHDRAW, functionName: 'exitPostExpToToken', args };
}
