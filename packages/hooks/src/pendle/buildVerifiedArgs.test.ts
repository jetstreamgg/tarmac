import { describe, expect, it } from 'vitest';
import { buildVerifiedArgs } from './buildVerifiedArgs';
import {
  PENDLE_EMPTY_LIMIT,
  PENDLE_EMPTY_SWAP_DATA,
  PendleConvertSide
} from './constants';
import type { PendleConvertQuote } from './pendle';

const RECEIVER = '0x1111111111111111111111111111111111111111' as const;
const MARKET = '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as const;
const USDG = '0xe343167631d89B6Ffc58B88d6b7fB0228795491D' as const;
const PT_USDG = '0x9db38D74a0D29380899aD354121DfB521aDb0548' as const;
const ZERO = '0x0000000000000000000000000000000000000000' as const;

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

function makeBuyParams(overrides: {
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
} = {}): unknown[] {
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
  amountIn: 100_000_000n,
  slippage: 0.002
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
    const verified = buyVerified(
      makeBuyQuote({ apiContractParams: makeBuyParams({ receiver: ATTACKER }) })
    );
    expect(verified.args[0]).toBe(RECEIVER);
  });

  it('overrides market even if API tries to swap markets', () => {
    const FAKE_MARKET = '0xbadbadbadbadbadbadbadbadbadbadbadbadbadb';
    const verified = buyVerified(
      makeBuyQuote({ apiContractParams: makeBuyParams({ market: FAKE_MARKET }) })
    );
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

  function makeWithdrawParams(overrides: {
    receiver?: string;
    market?: string;
    exactPtIn?: string;
    outputTokenOut?: string;
    outputMinTokenOut?: string;
    outputTokenRedeemSy?: string;
    outputPendleSwap?: string;
  } = {}): unknown[] {
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
    amountIn: 100_000_000n,
    slippage: 0.005
  };

  function withdrawVerified(quote: PendleConvertQuote, known = WITHDRAW_KNOWN) {
    const verified = buildVerifiedArgs(quote, known);
    if (verified.side !== PendleConvertSide.WITHDRAW) {
      throw new Error('expected WITHDRAW side');
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
