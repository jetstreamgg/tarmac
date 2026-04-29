import {
  PENDLE_ALLOWED_SELECTORS,
  PENDLE_EMPTY_LIMIT,
  PENDLE_EMPTY_SWAP_DATA,
  PendleConvertSide
} from './constants';
import { applySlippageToMinOut } from './helpers';
import type { PendleConvertQuote } from './pendle';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PendleSelectorNotAllowedError extends Error {
  constructor(method: string, side: PendleConvertSide) {
    super(`Pendle: refusing to sign — selector "${method}" not allowed for ${side}`);
    this.name = 'PendleSelectorNotAllowedError';
  }
}

export class PendleMalformedQuoteError extends Error {
  constructor(reason: string) {
    super(`Pendle: refusing to sign — malformed quote: ${reason}`);
    this.name = 'PendleMalformedQuoteError';
  }
}

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

export type VerifiedCall =
  | { side: PendleConvertSide.BUY; functionName: 'swapExactTokenForPt'; args: VerifiedBuyArgs }
  | {
      side: PendleConvertSide.WITHDRAW;
      functionName: 'swapExactPtForToken';
      args: VerifiedWithdrawArgs;
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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const verifiedEmptySwapData: VerifiedSwapData = PENDLE_EMPTY_SWAP_DATA;
const verifiedEmptyLimit: VerifiedLimit = PENDLE_EMPTY_LIMIT;

/**
 * Resolve the on-chain `minPtOut` / `minTokenOut` enforced in the call.
 *
 * Pendle's API computes `apiMinOut` factoring in fees and AMM curve nonlinearity,
 * not just `amountOut * (1 - slippage)`. We trust that value because the API is
 * the source of truth for AMM math, but we also enforce a local floor so a
 * compromised API cannot lower minOut below what the user's slippage allows.
 *
 * Result: `max(apiMinOut, localFloor)`.
 *   - Honest API where its formula matches ours → values equal, behavior unchanged.
 *   - Honest API where its formula is tighter (higher) → we use the tighter bound (better protection).
 *   - Compromised API trying to set apiMinOut = 0 → we use the local floor (sandwich protection preserved).
 */
function resolveMinOut(apiMinOut: bigint, amountOut: bigint, slippage: number): bigint {
  const localFloor = applySlippageToMinOut(amountOut, slippage);
  return apiMinOut > localFloor ? apiMinOut : localFloor;
}

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
    throw new PendleMalformedQuoteError('apiContractParams[3] (guessPtOut) missing or not an object');
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
    throw new PendleMalformedQuoteError('apiContractParams[3] (guessPtOut) has non-numeric fields');
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
    throw new PendleSelectorNotAllowedError(quote.method, known.side);
  }

  // 2 + 3. Rebuild args from known values + force-empty
  if (known.side === PendleConvertSide.BUY) {
    return buildBuyArgs(quote, known);
  }
  return buildWithdrawArgs(quote, known);
}

// ---------------------------------------------------------------------------
// Buy: swapExactTokenForPt(receiver, market, minPtOut, guessPtOut, input, limit)
// ---------------------------------------------------------------------------

function buildBuyArgs(quote: PendleConvertQuote, known: KnownCallValues): VerifiedCall {
  const guessPtOut = extractGuessPtOut(quote.apiContractParams);
  const minPtOut = resolveMinOut(quote.apiMinOut, quote.amountOut, known.slippage);

  const args: VerifiedBuyArgs = [
    known.receiver,
    known.market,
    minPtOut,
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
  const minTokenOut = resolveMinOut(quote.apiMinOut, quote.amountOut, known.slippage);

  const args: VerifiedWithdrawArgs = [
    known.receiver,
    known.market,
    known.amountIn,
    {
      tokenOut: known.outputToken,
      minTokenOut,
      tokenRedeemSy: known.outputToken, // the no-aggregator invariant
      pendleSwap: ZERO_ADDRESS,
      swapData: verifiedEmptySwapData
    },
    verifiedEmptyLimit
  ] as const;

  return { side: PendleConvertSide.WITHDRAW, functionName: 'swapExactPtForToken', args };
}
