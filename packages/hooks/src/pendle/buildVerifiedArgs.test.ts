import { describe, expect, it } from 'vitest';
import { buildVerifiedArgs, buildMaturedRedeemVerifiedArgs } from './buildVerifiedArgs';
import { PENDLE_EMPTY_LIMIT, PENDLE_EMPTY_SWAP_DATA, PendleConvertSide } from './constants';
import type { PendleConvertQuote } from './pendle';

const RECEIVER = '0x1111111111111111111111111111111111111111' as const;
const MARKET = '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as const;
const USDG = '0xe343167631d89B6Ffc58B88d6b7fB0228795491D' as const;
const PT_USDG = '0x9db38D74a0D29380899aD354121DfB521aDb0548' as const;
const ZERO = '0x0000000000000000000000000000000000000000' as const;
const PINNED_PENDLE_SWAP = '0xd4f480965d2347d421f1bec7f545682e5ec2151d' as const;
// USDS — used as the non-underlying input/output for aggregator-branch tests
const USDS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F' as const;
const KYBER_ROUTER = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5' as const;

const API_GUESS = {
  guessMin: '50000000',
  guessMax: '101000000',
  guessOffchain: '100000000',
  maxIteration: '30',
  eps: '10000000000000'
};

const API_EMPTY_SWAP = {
  swapType: '0',
  extRouter: ZERO,
  extCalldata: '0x',
  needScale: false
};

const API_EMPTY_LIMIT = {
  limitRouter: ZERO,
  epsSkipMarket: '0',
  normalFills: [],
  flashFills: [],
  optData: '0x'
};

const BUY_PARAM_NAMES = ['receiver', 'market', 'minPtOut', 'guessPtOut', 'input', 'limit'];

function makeBuyParams(
  overrides: {
    receiver?: string;
    market?: string;
    minPtOut?: string;
    guessPtOut?: typeof API_GUESS;
    inputTokenIn?: string;
    inputNetTokenIn?: string;
    inputTokenMintSy?: string;
    inputPendleSwap?: string;
    inputSwapData?: typeof API_EMPTY_SWAP;
    limit?: typeof API_EMPTY_LIMIT;
  } = {}
): unknown[] {
  return [
    overrides.receiver ?? RECEIVER,
    overrides.market ?? MARKET,
    overrides.minPtOut ?? '99000000',
    overrides.guessPtOut ?? API_GUESS,
    {
      tokenIn: overrides.inputTokenIn ?? USDG,
      netTokenIn: overrides.inputNetTokenIn ?? '100000000',
      tokenMintSy: overrides.inputTokenMintSy ?? USDG,
      pendleSwap: overrides.inputPendleSwap ?? ZERO,
      swapData: overrides.inputSwapData ?? API_EMPTY_SWAP
    },
    overrides.limit ?? API_EMPTY_LIMIT
  ];
}

function makeBuyQuote(overrides: Partial<PendleConvertQuote> = {}): PendleConvertQuote {
  return {
    method: 'swapExactTokenForPt',
    amountOut: 100_000_000n,
    apiMinOut: 99_800_000n,
    effectiveApy: 0.05,
    impliedApy: 0.058,
    priceImpact: -0.0002,
    fetchedAt: Date.now(),
    apiContractParams: makeBuyParams(),
    apiContractParamsName: BUY_PARAM_NAMES,
    ...overrides
  };
}

const BUY_KNOWN = {
  side: PendleConvertSide.BUY,
  receiver: RECEIVER,
  market: MARKET,
  inputToken: USDG,
  outputToken: PT_USDG,
  underlyingToken: USDG,
  amountIn: 100_000_000n,
  pinnedPendleSwap: PINNED_PENDLE_SWAP
};

describe('buildVerifiedArgs — Buy', () => {
  function buyVerified(quote: PendleConvertQuote, known = BUY_KNOWN) {
    const verified = buildVerifiedArgs(quote, known);
    if (verified.side !== PendleConvertSide.BUY) {
      throw new Error('expected BUY side');
    }
    return verified;
  }

  it('produces the correct empty-struct shape on a clean quote', () => {
    const verified = buyVerified(makeBuyQuote());

    expect(verified.functionName).toBe('swapExactTokenForPt');
    const [receiver, market, minPtOut, guess, input, limit] = verified.args;
    expect(receiver).toBe(RECEIVER);
    expect(market).toBe(MARKET);
    // minPtOut = 100_000_000 * (1 - 0.002) = 99_800_000
    expect(minPtOut).toBe(99_800_000n);
    // guessPtOut passed through (coerced to bigint)
    expect(guess.guessOffchain).toBe(100_000_000n);
    expect(guess.maxIteration).toBe(30n);
    expect(input.tokenIn).toBe(USDG);
    expect(input.netTokenIn).toBe(100_000_000n);
    expect(input.tokenMintSy).toBe(USDG); // === tokenIn
    expect(input.pendleSwap).toBe(ZERO);
    expect(input.swapData).toEqual(PENDLE_EMPTY_SWAP_DATA);
    expect(limit).toEqual(PENDLE_EMPTY_LIMIT);
  });

  it('overrides receiver even if API returns an attacker address', () => {
    const ATTACKER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const verified = buyVerified(makeBuyQuote({ apiContractParams: makeBuyParams({ receiver: ATTACKER }) }));
    expect(verified.args[0]).toBe(RECEIVER);
  });

  it('overrides market even if API tries to swap markets', () => {
    const FAKE_MARKET = '0xbadbadbadbadbadbadbadbadbadbadbadbadbadb';
    const verified = buyVerified(makeBuyQuote({ apiContractParams: makeBuyParams({ market: FAKE_MARKET }) }));
    expect(verified.args[1]).toBe(MARKET);
  });

  it('overrides netTokenIn — defends infinite-approval users', () => {
    const verified = buyVerified(
      makeBuyQuote({
        apiContractParams: makeBuyParams({ inputNetTokenIn: '999999999999' })
      })
    );
    expect(verified.args[4].netTokenIn).toBe(100_000_000n);
  });

  it('passes apiMinOut through as minPtOut', () => {
    const verified = buyVerified(makeBuyQuote({ apiMinOut: 99_800_000n }));
    expect(verified.args[2]).toBe(99_800_000n);
  });

  it('forces tokenMintSy === tokenIn (no-aggregator invariant)', () => {
    const ANOTHER_TOKEN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const verified = buyVerified(
      makeBuyQuote({ apiContractParams: makeBuyParams({ inputTokenMintSy: ANOTHER_TOKEN }) })
    );
    expect(verified.args[4].tokenMintSy).toBe(USDG); // === BUY_KNOWN.inputToken
  });

  it('forces pendleSwap and swapData empty even if API populates them', () => {
    const ATTACK_SWAP = {
      swapType: '1',
      extRouter: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as `0x${string}`,
      extCalldata: '0xa9059cbb' as `0x${string}`,
      needScale: true
    };
    const ATTACKER = '0xbadbadbadbadbadbadbadbadbadbadbadbadbadb';
    const verified = buyVerified(
      makeBuyQuote({
        apiContractParams: makeBuyParams({
          inputPendleSwap: ATTACKER,
          inputSwapData: ATTACK_SWAP as never
        })
      })
    );
    expect(verified.args[4].pendleSwap).toBe(ZERO);
    expect(verified.args[4].swapData).toEqual(PENDLE_EMPTY_SWAP_DATA);
  });

  it('forces limit empty even if API populates it', () => {
    const ATTACK_LIMIT = {
      limitRouter: '0xbadbadbadbadbadbadbadbadbadbadbadbadbadb' as `0x${string}`,
      epsSkipMarket: '999',
      normalFills: [],
      flashFills: [],
      optData: '0xdeadbeef' as `0x${string}`
    };
    const verified = buyVerified(
      makeBuyQuote({ apiContractParams: makeBuyParams({ limit: ATTACK_LIMIT as never }) })
    );
    expect(verified.args[5]).toEqual(PENDLE_EMPTY_LIMIT);
  });

  it('throws on an unknown method (selector allowlist)', () => {
    const quote = makeBuyQuote({ method: 'addLiquiditySinglePt' });
    expect(() => buildVerifiedArgs(quote, BUY_KNOWN)).toThrow(/selector .* not allowed/);
  });

  it('throws if BUY allowlist receives a withdraw selector', () => {
    const quote = makeBuyQuote({ method: 'swapExactPtForToken' });
    expect(() => buildVerifiedArgs(quote, BUY_KNOWN)).toThrow(/selector .* not allowed/);
  });

  it('throws when guessPtOut is missing (malformed quote)', () => {
    const quote = makeBuyQuote({
      apiContractParams: [RECEIVER, MARKET, '99000000', undefined, {}, API_EMPTY_LIMIT]
    });
    expect(() => buildVerifiedArgs(quote, BUY_KNOWN)).toThrow(/malformed quote/);
  });
});

describe('buildVerifiedArgs — Withdraw', () => {
  const WITHDRAW_PARAM_NAMES = ['receiver', 'market', 'exactPtIn', 'output', 'limit'];

  function makeWithdrawParams(
    overrides: {
      receiver?: string;
      market?: string;
      exactPtIn?: string;
      outputTokenOut?: string;
      outputMinTokenOut?: string;
      outputTokenRedeemSy?: string;
      outputPendleSwap?: string;
    } = {}
  ): unknown[] {
    return [
      overrides.receiver ?? RECEIVER,
      overrides.market ?? MARKET,
      overrides.exactPtIn ?? '100000000',
      {
        tokenOut: overrides.outputTokenOut ?? USDG,
        minTokenOut: overrides.outputMinTokenOut ?? '99000000',
        tokenRedeemSy: overrides.outputTokenRedeemSy ?? USDG,
        pendleSwap: overrides.outputPendleSwap ?? ZERO,
        swapData: API_EMPTY_SWAP
      },
      API_EMPTY_LIMIT
    ];
  }

  function makeWithdrawQuote(overrides: Partial<PendleConvertQuote> = {}): PendleConvertQuote {
    return {
      method: 'swapExactPtForToken',
      amountOut: 100_000_000n,
      apiMinOut: 99_500_000n,
      effectiveApy: 0.05,
      impliedApy: 0.058,
      priceImpact: -0.0002,
      fetchedAt: Date.now(),
      apiContractParams: makeWithdrawParams(),
      apiContractParamsName: WITHDRAW_PARAM_NAMES,
      ...overrides
    };
  }

  const WITHDRAW_KNOWN = {
    side: PendleConvertSide.WITHDRAW,
    receiver: RECEIVER,
    market: MARKET,
    inputToken: PT_USDG,
    outputToken: USDG,
    underlyingToken: USDG,
    amountIn: 100_000_000n,
    pinnedPendleSwap: PINNED_PENDLE_SWAP
  };

  function withdrawVerified(quote: PendleConvertQuote, known = WITHDRAW_KNOWN) {
    const verified = buildVerifiedArgs(quote, known);
    if (verified.functionName !== 'swapExactPtForToken') {
      throw new Error('expected swapExactPtForToken');
    }
    return verified;
  }

  it('produces a verified swapExactPtForToken call', () => {
    const verified = withdrawVerified(makeWithdrawQuote());

    expect(verified.functionName).toBe('swapExactPtForToken');
    const [receiver, market, exactPtIn, output, limit] = verified.args;
    expect(receiver).toBe(RECEIVER);
    expect(market).toBe(MARKET);
    expect(exactPtIn).toBe(100_000_000n);
    expect(output.tokenOut).toBe(USDG);
    expect(output.tokenRedeemSy).toBe(USDG);
    expect(output.pendleSwap).toBe(ZERO);
    expect(output.swapData).toEqual(PENDLE_EMPTY_SWAP_DATA);
    expect(output.minTokenOut).toBe(99_500_000n); // apiMinOut passed through
    expect(limit).toEqual(PENDLE_EMPTY_LIMIT);
  });

  it('throws on an unknown method (selector allowlist)', () => {
    const quote = makeWithdrawQuote({ method: 'redeemPyToToken' });
    expect(() => buildVerifiedArgs(quote, WITHDRAW_KNOWN)).toThrow(/selector .* not allowed/);
  });
});

// ---------------------------------------------------------------------------
// Aggregator branch — input/output token differs from underlying. Pendle's
// API returns a non-zero pendleSwap (the pinned PendleSwap forwarder) and a
// populated swapData; tokenMintSy / tokenRedeemSy must equal the underlying.
// ---------------------------------------------------------------------------

const KYBER_SWAP_DATA = {
  swapType: 1,
  extRouter: KYBER_ROUTER,
  extCalldata: ('0x' + 'ab'.repeat(120)) as `0x${string}`,
  needScale: false
};

describe('buildVerifiedArgs — Buy aggregator branch', () => {
  // User supplies USDS (not the underlying USDG). The API returns a route
  // through Pendle's PendleSwap → KyberSwap → USDG → SY.
  const BUY_AGG_KNOWN = {
    side: PendleConvertSide.BUY,
    receiver: RECEIVER,
    market: MARKET,
    inputToken: USDS, // user-picked, NOT the underlying
    outputToken: PT_USDG,
    underlyingToken: USDG,
    amountIn: 100_000_000_000_000_000_000n, // 100 USDS (18 decimals)
    pinnedPendleSwap: PINNED_PENDLE_SWAP
  };

  function makeAggBuyParams(
    opts: {
      pendleSwap?: string;
      swapType?: string;
      extRouter?: string;
      extCalldata?: string;
      inputTokenMintSy?: string;
    } = {}
  ): unknown[] {
    return [
      RECEIVER,
      MARKET,
      '99000000',
      API_GUESS,
      {
        tokenIn: USDS,
        netTokenIn: '100000000000000000000',
        tokenMintSy: opts.inputTokenMintSy ?? USDG,
        pendleSwap: opts.pendleSwap ?? PINNED_PENDLE_SWAP,
        swapData: {
          swapType: opts.swapType ?? '1',
          extRouter: opts.extRouter ?? KYBER_ROUTER,
          extCalldata: opts.extCalldata ?? KYBER_SWAP_DATA.extCalldata,
          needScale: false
        }
      },
      API_EMPTY_LIMIT
    ];
  }

  function makeAggBuyQuote(overrides: Partial<PendleConvertQuote> = {}): PendleConvertQuote {
    return {
      method: 'swapExactTokenForPt',
      amountOut: 100_000_000n,
      apiMinOut: 99_800_000n,
      effectiveApy: 0.05,
      impliedApy: 0.058,
      priceImpact: -0.0002,
      aggregatorType: 'KYBERSWAP',
      aggregatorRoute: {
        pendleSwap: PINNED_PENDLE_SWAP,
        swapData: KYBER_SWAP_DATA
      },
      fetchedAt: Date.now(),
      apiContractParams: makeAggBuyParams(),
      apiContractParamsName: BUY_PARAM_NAMES,
      ...overrides
    };
  }

  it('forwards pendleSwap and swapData when input ≠ underlying', () => {
    const verified = buildVerifiedArgs(makeAggBuyQuote(), BUY_AGG_KNOWN);
    if (verified.side !== PendleConvertSide.BUY) throw new Error('expected BUY');
    expect(verified.args[4].pendleSwap).toBe(PINNED_PENDLE_SWAP);
    expect(verified.args[4].swapData).toEqual(KYBER_SWAP_DATA);
  });

  it('pins tokenMintSy to the underlying (not the user-picked input)', () => {
    const verified = buildVerifiedArgs(makeAggBuyQuote(), BUY_AGG_KNOWN);
    if (verified.side !== PendleConvertSide.BUY) throw new Error('expected BUY');
    expect(verified.args[4].tokenIn).toBe(USDS); // user-picked, kept as tokenIn
    expect(verified.args[4].tokenMintSy).toBe(USDG); // pinned to underlying
  });

  it('rejects when the API returns a non-pinned pendleSwap', () => {
    const ATTACKER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as const;
    const quote = makeAggBuyQuote({
      aggregatorRoute: { pendleSwap: ATTACKER, swapData: KYBER_SWAP_DATA }
    });
    expect(() => buildVerifiedArgs(quote, BUY_AGG_KNOWN)).toThrow(/not the pinned forwarder/);
  });

  it('rejects when input ≠ underlying but the quote has no aggregatorRoute', () => {
    const quote = makeAggBuyQuote({ aggregatorRoute: undefined });
    expect(() => buildVerifiedArgs(quote, BUY_AGG_KNOWN)).toThrow(/aggregator required/);
  });

  it('uses the no-aggregator path when input === underlying even if aggregatorRoute is present', () => {
    // Sanity: BUY_KNOWN has inputToken == USDG (the underlying); presence of
    // aggregatorRoute on the quote should be ignored.
    const quote = makeAggBuyQuote({
      aggregatorRoute: { pendleSwap: PINNED_PENDLE_SWAP, swapData: KYBER_SWAP_DATA }
    });
    quote.method = 'swapExactTokenForPt';
    quote.apiContractParams = makeBuyParams();
    const verified = buildVerifiedArgs(quote, BUY_KNOWN);
    if (verified.side !== PendleConvertSide.BUY) throw new Error('expected BUY');
    expect(verified.args[4].pendleSwap).toBe(ZERO);
    expect(verified.args[4].swapData).toEqual(PENDLE_EMPTY_SWAP_DATA);
    expect(verified.args[4].tokenMintSy).toBe(USDG);
  });
});

describe('buildVerifiedArgs — Withdraw aggregator branch', () => {
  // User wants USDS out (not the underlying USDG).
  const WITHDRAW_AGG_KNOWN = {
    side: PendleConvertSide.WITHDRAW,
    receiver: RECEIVER,
    market: MARKET,
    inputToken: PT_USDG,
    outputToken: USDS, // user-picked, NOT the underlying
    underlyingToken: USDG,
    amountIn: 100_000_000n,
    pinnedPendleSwap: PINNED_PENDLE_SWAP
  };

  function makeAggWithdrawParams(
    opts: { pendleSwap?: string; outputTokenRedeemSy?: string } = {}
  ): unknown[] {
    return [
      RECEIVER,
      MARKET,
      '100000000',
      {
        tokenOut: USDS,
        minTokenOut: '99000000000000000000',
        tokenRedeemSy: opts.outputTokenRedeemSy ?? USDG,
        pendleSwap: opts.pendleSwap ?? PINNED_PENDLE_SWAP,
        swapData: {
          swapType: '1',
          extRouter: KYBER_ROUTER,
          extCalldata: KYBER_SWAP_DATA.extCalldata,
          needScale: false
        }
      },
      API_EMPTY_LIMIT
    ];
  }

  function makeAggWithdrawQuote(overrides: Partial<PendleConvertQuote> = {}): PendleConvertQuote {
    return {
      method: 'swapExactPtForToken',
      amountOut: 100_000_000n,
      apiMinOut: 99_500_000_000_000_000_000n,
      effectiveApy: 0.05,
      impliedApy: 0.058,
      priceImpact: -0.0002,
      aggregatorType: 'KYBERSWAP',
      aggregatorRoute: {
        pendleSwap: PINNED_PENDLE_SWAP,
        swapData: KYBER_SWAP_DATA
      },
      fetchedAt: Date.now(),
      apiContractParams: makeAggWithdrawParams(),
      apiContractParamsName: ['receiver', 'market', 'exactPtIn', 'output', 'limit'],
      ...overrides
    };
  }

  it('pins tokenRedeemSy to the underlying when output ≠ underlying', () => {
    const verified = buildVerifiedArgs(makeAggWithdrawQuote(), WITHDRAW_AGG_KNOWN);
    if (verified.functionName !== 'swapExactPtForToken') throw new Error('expected swapExactPtForToken');
    expect(verified.args[3].tokenOut).toBe(USDS); // user-picked, kept as tokenOut
    expect(verified.args[3].tokenRedeemSy).toBe(USDG); // pinned to underlying
    expect(verified.args[3].pendleSwap).toBe(PINNED_PENDLE_SWAP);
    expect(verified.args[3].swapData).toEqual(KYBER_SWAP_DATA);
  });

  it('rejects when the API returns a non-pinned pendleSwap', () => {
    const ATTACKER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as const;
    const quote = makeAggWithdrawQuote({
      aggregatorRoute: { pendleSwap: ATTACKER, swapData: KYBER_SWAP_DATA }
    });
    expect(() => buildVerifiedArgs(quote, WITHDRAW_AGG_KNOWN)).toThrow(/not the pinned forwarder/);
  });

  it('rejects when output ≠ underlying but quote has no aggregatorRoute', () => {
    const quote = makeAggWithdrawQuote({ aggregatorRoute: undefined });
    expect(() => buildVerifiedArgs(quote, WITHDRAW_AGG_KNOWN)).toThrow(/aggregator required/);
  });
});

describe('buildVerifiedArgs — Exit (matured-market withdraw)', () => {
  const EXIT_PARAM_NAMES = ['receiver', 'market', 'netPtIn', 'netLpIn', 'output'];

  function makeExitParams(
    overrides: {
      receiver?: string;
      market?: string;
      netPtIn?: string;
      netLpIn?: string;
      outputTokenOut?: string;
      outputMinTokenOut?: string;
      outputTokenRedeemSy?: string;
      outputPendleSwap?: string;
    } = {}
  ): unknown[] {
    return [
      overrides.receiver ?? RECEIVER,
      overrides.market ?? MARKET,
      overrides.netPtIn ?? '100000000',
      overrides.netLpIn ?? '0',
      {
        tokenOut: overrides.outputTokenOut ?? USDG,
        minTokenOut: overrides.outputMinTokenOut ?? '99000000',
        tokenRedeemSy: overrides.outputTokenRedeemSy ?? USDG,
        pendleSwap: overrides.outputPendleSwap ?? ZERO,
        swapData: { swapType: '0', extRouter: ZERO, extCalldata: '0x', needScale: false }
      }
    ];
  }

  function makeExitQuote(overrides: Partial<PendleConvertQuote> = {}): PendleConvertQuote {
    return {
      method: 'exitPostExpToToken',
      amountOut: 100_000_000n,
      apiMinOut: 99_800_000n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: -0.0045,
      fetchedAt: Date.now(),
      apiContractParams: makeExitParams(),
      apiContractParamsName: EXIT_PARAM_NAMES,
      ...overrides
    };
  }

  // WITHDRAW side — same as pre-maturity sell. The discriminator is the
  // API's method, not user intent.
  const EXIT_KNOWN = {
    side: PendleConvertSide.WITHDRAW,
    receiver: RECEIVER,
    market: MARKET,
    inputToken: PT_USDG,
    outputToken: USDG,
    underlyingToken: USDG,
    amountIn: 100_000_000n,
    pinnedPendleSwap: PINNED_PENDLE_SWAP
  };

  function exitVerified(quote: PendleConvertQuote, known = EXIT_KNOWN) {
    const verified = buildVerifiedArgs(quote, known);
    if (verified.functionName !== 'exitPostExpToToken') {
      throw new Error('expected exitPostExpToToken');
    }
    return verified;
  }

  it('produces a verified exitPostExpToToken call with netLpIn forced to 0', () => {
    const verified = exitVerified(makeExitQuote());

    expect(verified.functionName).toBe('exitPostExpToToken');
    const [receiver, market, netPtIn, netLpIn, output] = verified.args;
    expect(receiver).toBe(RECEIVER);
    expect(market).toBe(MARKET);
    expect(netPtIn).toBe(100_000_000n);
    expect(netLpIn).toBe(0n); // forced to 0 — v1 does not expose LP
    expect(output.tokenOut).toBe(USDG);
    expect(output.tokenRedeemSy).toBe(USDG);
    expect(output.pendleSwap).toBe(ZERO);
    expect(output.swapData).toEqual(PENDLE_EMPTY_SWAP_DATA);
    expect(output.minTokenOut).toBe(99_800_000n);
    // No `limit` slot — exitPostExpToToken does not support limit orders
  });

  it('forces netLpIn to 0 even if API populates it', () => {
    const verified = exitVerified(
      makeExitQuote({ apiContractParams: makeExitParams({ netLpIn: '999999' }) })
    );
    expect(verified.args[3]).toBe(0n);
  });

  it('overrides receiver when API tries to redirect funds', () => {
    const ATTACKER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const verified = exitVerified(
      makeExitQuote({ apiContractParams: makeExitParams({ receiver: ATTACKER }) })
    );
    expect(verified.args[0]).toBe(RECEIVER);
  });

  it('forces tokenRedeemSy === tokenOut (no-aggregator invariant)', () => {
    const ANOTHER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const verified = exitVerified(
      makeExitQuote({ apiContractParams: makeExitParams({ outputTokenRedeemSy: ANOTHER }) })
    );
    expect(verified.args[4].tokenRedeemSy).toBe(USDG); // === EXIT_KNOWN.outputToken
  });
});

describe('buildVerifiedArgs — Exit aggregator branch', () => {
  // User redeems matured PT to USDS (not the underlying USDG). The API
  // returns a route through Pendle's PendleSwap → KyberSwap → USDS.
  const EXIT_AGG_KNOWN = {
    side: PendleConvertSide.WITHDRAW,
    receiver: RECEIVER,
    market: MARKET,
    inputToken: PT_USDG,
    outputToken: USDS, // user-picked, NOT the underlying
    underlyingToken: USDG,
    amountIn: 100_000_000n,
    pinnedPendleSwap: PINNED_PENDLE_SWAP
  };

  function makeAggExitParams(
    opts: {
      pendleSwap?: string;
      outputTokenRedeemSy?: string;
    } = {}
  ): unknown[] {
    return [
      RECEIVER,
      MARKET,
      '100000000',
      '0',
      {
        tokenOut: USDS,
        minTokenOut: '99000000000000000000',
        tokenRedeemSy: opts.outputTokenRedeemSy ?? USDG,
        pendleSwap: opts.pendleSwap ?? PINNED_PENDLE_SWAP,
        swapData: {
          swapType: '1',
          extRouter: KYBER_ROUTER,
          extCalldata: KYBER_SWAP_DATA.extCalldata,
          needScale: false
        }
      }
    ];
  }

  function makeAggExitQuote(overrides: Partial<PendleConvertQuote> = {}): PendleConvertQuote {
    return {
      method: 'exitPostExpToToken',
      amountOut: 100_000_000_000_000_000_000n,
      apiMinOut: 99_500_000_000_000_000_000n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: -0.0045,
      aggregatorType: 'KYBERSWAP',
      aggregatorRoute: {
        pendleSwap: PINNED_PENDLE_SWAP,
        swapData: KYBER_SWAP_DATA
      },
      fetchedAt: Date.now(),
      apiContractParams: makeAggExitParams(),
      apiContractParamsName: ['receiver', 'market', 'netPtIn', 'netLpIn', 'output'],
      ...overrides
    };
  }

  it('pins tokenRedeemSy to the underlying when output ≠ underlying', () => {
    const verified = buildVerifiedArgs(makeAggExitQuote(), EXIT_AGG_KNOWN);
    if (verified.functionName !== 'exitPostExpToToken') throw new Error('expected exitPostExpToToken');
    expect(verified.args[4].tokenOut).toBe(USDS); // user-picked, kept as tokenOut
    expect(verified.args[4].tokenRedeemSy).toBe(USDG); // pinned to underlying
    expect(verified.args[4].pendleSwap).toBe(PINNED_PENDLE_SWAP);
    expect(verified.args[4].swapData).toEqual(KYBER_SWAP_DATA);
  });

  it('rejects when the API returns a non-pinned pendleSwap', () => {
    const ATTACKER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as const;
    const quote = makeAggExitQuote({
      aggregatorRoute: { pendleSwap: ATTACKER, swapData: KYBER_SWAP_DATA }
    });
    expect(() => buildVerifiedArgs(quote, EXIT_AGG_KNOWN)).toThrow(/not the pinned forwarder/);
  });

  it('rejects when output ≠ underlying but quote has no aggregatorRoute', () => {
    const quote = makeAggExitQuote({ aggregatorRoute: undefined });
    expect(() => buildVerifiedArgs(quote, EXIT_AGG_KNOWN)).toThrow(/aggregator required/);
  });

  it('forces netLpIn to 0 even on aggregator-branch exit', () => {
    const verified = buildVerifiedArgs(makeAggExitQuote(), EXIT_AGG_KNOWN);
    expect(verified.args[3]).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// buildMaturedRedeemVerifiedArgs (quote-less)
// ---------------------------------------------------------------------------

describe('buildMaturedRedeemVerifiedArgs', () => {
  const ctx = {
    receiver: RECEIVER,
    market: MARKET,
    ptToken: PT_USDG,
    underlyingToken: USDG,
    amountIn: 100_000_000n
  };

  it('produces an exitPostExpToToken VerifiedCall', () => {
    const verified = buildMaturedRedeemVerifiedArgs(ctx);
    expect(verified.functionName).toBe('exitPostExpToToken');
    expect(verified.side).toBe(PendleConvertSide.WITHDRAW);
  });

  it('sets minTokenOut to 0 (matured redeem is deterministic 1:1)', () => {
    const verified = buildMaturedRedeemVerifiedArgs(ctx);
    expect(verified.args[4].minTokenOut).toBe(0n);
  });

  it('forces netLpIn to 0', () => {
    const verified = buildMaturedRedeemVerifiedArgs(ctx);
    expect(verified.args[3]).toBe(0n);
  });

  it('forces tokenRedeemSy === underlyingToken (no-aggregator invariant)', () => {
    const verified = buildMaturedRedeemVerifiedArgs(ctx);
    expect(verified.args[4].tokenRedeemSy).toBe(USDG);
    expect(verified.args[4].pendleSwap).toBe(ZERO);
    expect(verified.args[4].swapData).toEqual(PENDLE_EMPTY_SWAP_DATA);
  });

  it('throws when amountIn is zero', () => {
    expect(() => buildMaturedRedeemVerifiedArgs({ ...ctx, amountIn: 0n })).toThrow(/amountIn is zero/);
  });
});
