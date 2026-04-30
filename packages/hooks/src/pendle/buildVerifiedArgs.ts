import { ZERO_ADDRESS } from '../constants';
import {
  PENDLE_ALLOWED_SELECTORS,
  PENDLE_EMPTY_LIMIT,
  PENDLE_EMPTY_SWAP_DATA,
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
