import { encodeFunctionData } from 'viem';
import { ZERO_ADDRESS } from '../constants';
import {
  PENDLE_ALLOWED_SELECTORS,
  PENDLE_EMPTY_LIMIT,
  PENDLE_EMPTY_SWAP_DATA,
  PENDLE_ROUTER_V4_ABI,
  PendleConvertSide
} from './constants';
import type { PendleConvertQuote } from './pendle';

// ---------------------------------------------------------------------------
// Verified-args output (typed for the ABI)
// ---------------------------------------------------------------------------

type VerifiedSwapData = typeof PENDLE_EMPTY_SWAP_DATA;
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
 * Args for `exitPostExpToToken` — used to redeem PT for the underlying after
 * market expiry. v1 always passes `netLpIn = 0n` since we do not expose LP.
 * No `limit` parameter; this method does not support limit orders.
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
  /** For BUY: underlying token. For WITHDRAW: PT token. */
  inputToken: `0x${string}`;
  /** For BUY: PT token. For WITHDRAW: underlying token. */
  outputToken: `0x${string}`;
  amountIn: bigint;
  /** Decimal slippage (e.g. 0.002 = 0.2%) */
  slippage: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const verifiedEmptySwapData: VerifiedSwapData = PENDLE_EMPTY_SWAP_DATA;
const verifiedEmptyLimit: VerifiedLimit = PENDLE_EMPTY_LIMIT;

/**
 * Extract the `guessPtOut` solver hint from the API's parsed contract params.
 *
 * Position 3 in `swapExactTokenForPt`'s arg list per Pendle's docs. We pass
 * this through verbatim — bad values cause an on-chain revert (no fund loss)
 * since `minPtOut` is recomputed locally and provides the actual protection.
 *
 * Numeric fields come back as decimal wei strings (JSON has no native bigint).
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
 *   3. Force every dangerous field to its empty form
 *      (pendleSwap, swapData, limit) — see Pendle's StructGen.sol
 *
 * The resulting struct is byte-equivalent to what
 * `createTokenInputStruct(token, amount)` + `emptyLimit` would produce.
 *
 * The pinned-router guard is enforced upstream by usePendleConvert which
 * always submits to PENDLE_ROUTER_V4_ADDRESS — never to `quote.tx.to`.
 */
export function buildVerifiedArgs(quote: PendleConvertQuote, known: KnownCallValues): VerifiedCall {
  // 1. Per-flow allowlist
  const allowed = (
    known.side === PendleConvertSide.BUY ? PENDLE_ALLOWED_SELECTORS.buy : PENDLE_ALLOWED_SELECTORS.withdraw
  ) as readonly string[];
  if (!allowed.includes(quote.method)) {
    throw new Error(`Pendle: refusing to sign — selector "${quote.method}" not allowed for ${known.side}`);
  }

  // 2 + 3. Rebuild args from known values + force-empty.
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

  const args: VerifiedBuyArgs = [
    known.receiver,
    known.market,
    quote.apiMinOut,
    guessPtOut,
    {
      tokenIn: known.inputToken,
      netTokenIn: known.amountIn,
      tokenMintSy: known.inputToken, // the no-aggregator invariant
      pendleSwap: ZERO_ADDRESS,
      swapData: verifiedEmptySwapData
    },
    verifiedEmptyLimit
  ] as const;

  return { side: PendleConvertSide.BUY, functionName: 'swapExactTokenForPt', args };
}

// ---------------------------------------------------------------------------
// Withdraw: swapExactPtForToken(receiver, market, exactPtIn, output, limit)
// ---------------------------------------------------------------------------

function buildWithdrawArgs(quote: PendleConvertQuote, known: KnownCallValues): VerifiedCall {
  const args: VerifiedWithdrawArgs = [
    known.receiver,
    known.market,
    known.amountIn,
    {
      tokenOut: known.outputToken,
      minTokenOut: quote.apiMinOut,
      tokenRedeemSy: known.outputToken, // the no-aggregator invariant
      pendleSwap: ZERO_ADDRESS,
      swapData: verifiedEmptySwapData
    },
    verifiedEmptyLimit
  ] as const;

  return { side: PendleConvertSide.WITHDRAW, functionName: 'swapExactPtForToken', args };
}

// ---------------------------------------------------------------------------
// Exit: exitPostExpToToken(receiver, market, netPtIn, netLpIn, output)
// ---------------------------------------------------------------------------

function buildExitArgs(quote: PendleConvertQuote, known: KnownCallValues): VerifiedCall {
  const args: VerifiedExitArgs = [
    known.receiver,
    known.market,
    known.amountIn,
    0n, // netLpIn — v1 does not expose LP
    {
      tokenOut: known.outputToken,
      minTokenOut: quote.apiMinOut,
      tokenRedeemSy: known.outputToken, // the no-aggregator invariant
      pendleSwap: ZERO_ADDRESS,
      swapData: verifiedEmptySwapData
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

// ---------------------------------------------------------------------------
// Multicall — wraps N already-verified inner calls into Router.multicall(bytes[])
// ---------------------------------------------------------------------------

/** One element of the Pendle Router multicall input — `Call3` in Solidity. */
export type VerifiedMulticallCall = {
  allowFailure: boolean;
  callData: `0x${string}`;
};

export type VerifiedMulticall = {
  functionName: 'multicall';
  /** [Call3[]] — single arg, the array of (allowFailure, callData) tuples */
  args: readonly [readonly VerifiedMulticallCall[]];
  /** The inner verified calls in order, exposed for caller introspection */
  innerCalls: readonly VerifiedCall[];
};

/**
 * Wrap N pre-verified inner calls into a single Router.multicall(bytes[]).
 *
 * Each `inner` MUST already be the output of `buildVerifiedArgs()` or
 * `buildMaturedRedeemVerifiedArgs()` — i.e. selector-allowlisted, fields
 * overridden from known values, and pendleSwap/swapData/limit forced empty.
 * This wrapper does NOT re-verify; it only encodes via viem and bundles.
 *
 * Pinned-router guard: caller must submit to PENDLE_ROUTER_V4_ADDRESS. The
 * Pendle Router's native multicall preserves msg.sender via internal
 * delegate-call, so each inner call sees the original user as the caller —
 * which means PT pulls work without any approval indirection.
 */
export function buildMulticallVerifiedArgs(inner: readonly VerifiedCall[]): VerifiedMulticall {
  if (inner.length === 0) {
    throw new Error('Pendle: refusing to build multicall — no inner calls provided');
  }
  const calls: VerifiedMulticallCall[] = inner.map(call => {
    // viem's encodeFunctionData uses the ABI to find the matching function +
    // encode its args. The verified call's `functionName` is from a closed
    // discriminated union, so we know it matches an ABI entry.
    const callData = encodeFunctionData({
      abi: PENDLE_ROUTER_V4_ABI,
      functionName: call.functionName,
      args: call.args as never
    });
    // allowFailure is hard-coded to false: a partial multicall would
    // approve PT but leave funds stranded mid-batch. We want all-or-nothing.
    return { allowFailure: false, callData };
  });
  return {
    functionName: 'multicall',
    args: [calls] as const,
    innerCalls: inner
  };
}
