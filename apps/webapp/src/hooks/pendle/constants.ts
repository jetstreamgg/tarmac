import { mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID, ZERO_ADDRESS } from '../constants';
import type { PendleMarketConfig } from './pendle';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Direction of a /convert call */
export enum PendleConvertSide {
  BUY = 'buy',
  WITHDRAW = 'withdraw'
}

/**
 * Action discriminant for normalized market-history rows. Every row originates
 * from /v1/pnl/transactions; the wire `action` values (buyPt, sellPt, redeemPy)
 * are mapped to these canonical uppercase values at the transport boundary in
 * usePendleAllPnlTransactions. The PnL endpoint surfaces a 28-value action
 * enum (mintPy, buyYt, sellYt, addLiquidity*, removeLiquidity*, swapPtToYt,
 * swapYtToPt, transfer*, redeem*Rewards, *LimitOrder, …); everything outside
 * the three values below is filtered out client-side.
 */
export enum PendleHistoryAction {
  BUY_PT = 'BUY_PT',
  SELL_PT = 'SELL_PT',
  REDEEM_PY = 'REDEEM_PY'
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const PENDLE_API_BASE_URL = 'https://api-v2.pendle.finance/core';

/**
 * Default refetch cadence and TTL for /convert quotes.
 * These are conservative defaults; verify against Pendle's documented quote TTL
 * during integration QA and tighten if they specify a value.
 */
export const PENDLE_QUOTE_REFETCH_MS = 60_000;
export const PENDLE_QUOTE_TTL_MS = 90_000;

// ---------------------------------------------------------------------------
// Slippage defaults
// ---------------------------------------------------------------------------

/** 0.2% — applied to Buy, Sell, and Redeem in v1. */
export const PENDLE_DEFAULT_SLIPPAGE = 0.002;

// ---------------------------------------------------------------------------
// Pendle Router V4
// ---------------------------------------------------------------------------

/**
 * Pendle Router V4 — only the mainnet deployment is registered here because
 * our integration only adds mainnet markets. Tenderly fork uses the same
 * address since it mirrors mainnet state. Verified at:
 * https://etherscan.io/address/0x888888888889758F76e7103c6CbF23ABbF58F946
 *
 * Note: the deployed contract is a multi-action proxy that delegates each
 * function to a separate action contract, so Etherscan's getabi only returns
 * the bare proxy ABI. The full router interface is defined inline below
 * (PENDLE_ROUTER_V4_ABI), restricted to only the selectors we allow.
 */
export const PENDLE_ROUTER_V4_ADDRESS: Record<number, `0x${string}`> = {
  [mainnet.id]: '0x888888888889758F76e7103c6CbF23ABbF58F946',
  [TENDERLY_CHAIN_ID]: '0x888888888889758F76e7103c6CbF23ABbF58F946'
};

/**
 * Pinned Pendle SwapAggregatorRouter (a.k.a. PendleSwap) — the only contract
 * we permit as the `pendleSwap` field when an aggregator route is taken. This
 * Pendle-deployed forwarder is the audited bridge between the Router V4 and
 * external aggregators (KyberSwap, Odos, OKX, Paraswap, …). If the API ever
 * returns a different `pendleSwap`, buildVerifiedArgs refuses to sign — that
 * is the single trust anchor of the multi-token / aggregator path.
 *
 * Tenderly fork mirrors mainnet state, so the same address applies.
 */
export const PENDLE_PINNED_PENDLESWAP_ADDRESSES: Record<number, `0x${string}`> = {
  [mainnet.id]: '0xd4f480965d2347d421f1bec7f545682e5ec2151d',
  [TENDERLY_CHAIN_ID]: '0xd4f480965d2347d421f1bec7f545682e5ec2151d'
};

/**
 * Minimal Pendle Router V4 ABI — only the selectors v1 allows for PT trading.
 *
 * IMPORTANT: this ABI is intentionally minimal. `decodeFunctionData` against
 * this ABI will throw on any selector not listed here, which is part of the
 * security model (see usePendleConvert.ts). To support a new flow, add the
 * selector here AND extend buildVerifiedArgs accordingly.
 *
 * Allowlisted selectors:
 *   - swapExactTokenForPt   (Buy)
 *   - swapExactPtForToken   (Sell pre-maturity, possibly Redeem post-maturity)
 *
 * Reference: https://github.com/pendle-finance/pendle-examples-public/blob/main/src/StructGen.sol
 */
export const PENDLE_ROUTER_V4_ABI = [
  {
    type: 'function',
    name: 'swapExactTokenForPt',
    stateMutability: 'payable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'market', type: 'address' },
      { name: 'minPtOut', type: 'uint256' },
      {
        name: 'guessPtOut',
        type: 'tuple',
        components: [
          { name: 'guessMin', type: 'uint256' },
          { name: 'guessMax', type: 'uint256' },
          { name: 'guessOffchain', type: 'uint256' },
          { name: 'maxIteration', type: 'uint256' },
          { name: 'eps', type: 'uint256' }
        ]
      },
      {
        name: 'input',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'netTokenIn', type: 'uint256' },
          { name: 'tokenMintSy', type: 'address' },
          { name: 'pendleSwap', type: 'address' },
          {
            name: 'swapData',
            type: 'tuple',
            components: [
              { name: 'swapType', type: 'uint8' },
              { name: 'extRouter', type: 'address' },
              { name: 'extCalldata', type: 'bytes' },
              { name: 'needScale', type: 'bool' }
            ]
          }
        ]
      },
      {
        name: 'limit',
        type: 'tuple',
        components: [
          { name: 'limitRouter', type: 'address' },
          { name: 'epsSkipMarket', type: 'uint256' },
          {
            name: 'normalFills',
            type: 'tuple[]',
            components: [
              {
                name: 'order',
                type: 'tuple',
                components: [
                  { name: 'salt', type: 'uint256' },
                  { name: 'expiry', type: 'uint256' },
                  { name: 'nonce', type: 'uint256' },
                  { name: 'orderType', type: 'uint8' },
                  { name: 'token', type: 'address' },
                  { name: 'YT', type: 'address' },
                  { name: 'maker', type: 'address' },
                  { name: 'receiver', type: 'address' },
                  { name: 'makingAmount', type: 'uint256' },
                  { name: 'lnImpliedRate', type: 'uint256' },
                  { name: 'failSafeRate', type: 'uint256' },
                  { name: 'permit', type: 'bytes' }
                ]
              },
              { name: 'signature', type: 'bytes' },
              { name: 'makingAmount', type: 'uint256' }
            ]
          },
          {
            name: 'flashFills',
            type: 'tuple[]',
            components: [
              {
                name: 'order',
                type: 'tuple',
                components: [
                  { name: 'salt', type: 'uint256' },
                  { name: 'expiry', type: 'uint256' },
                  { name: 'nonce', type: 'uint256' },
                  { name: 'orderType', type: 'uint8' },
                  { name: 'token', type: 'address' },
                  { name: 'YT', type: 'address' },
                  { name: 'maker', type: 'address' },
                  { name: 'receiver', type: 'address' },
                  { name: 'makingAmount', type: 'uint256' },
                  { name: 'lnImpliedRate', type: 'uint256' },
                  { name: 'failSafeRate', type: 'uint256' },
                  { name: 'permit', type: 'bytes' }
                ]
              },
              { name: 'signature', type: 'bytes' },
              { name: 'makingAmount', type: 'uint256' }
            ]
          },
          { name: 'optData', type: 'bytes' }
        ]
      }
    ],
    outputs: [
      { name: 'netPtOut', type: 'uint256' },
      { name: 'netSyFee', type: 'uint256' },
      { name: 'netSyInterm', type: 'uint256' }
    ]
  },
  {
    type: 'function',
    name: 'swapExactPtForToken',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'market', type: 'address' },
      { name: 'exactPtIn', type: 'uint256' },
      {
        name: 'output',
        type: 'tuple',
        components: [
          { name: 'tokenOut', type: 'address' },
          { name: 'minTokenOut', type: 'uint256' },
          { name: 'tokenRedeemSy', type: 'address' },
          { name: 'pendleSwap', type: 'address' },
          {
            name: 'swapData',
            type: 'tuple',
            components: [
              { name: 'swapType', type: 'uint8' },
              { name: 'extRouter', type: 'address' },
              { name: 'extCalldata', type: 'bytes' },
              { name: 'needScale', type: 'bool' }
            ]
          }
        ]
      },
      {
        name: 'limit',
        type: 'tuple',
        components: [
          { name: 'limitRouter', type: 'address' },
          { name: 'epsSkipMarket', type: 'uint256' },
          {
            name: 'normalFills',
            type: 'tuple[]',
            components: [
              {
                name: 'order',
                type: 'tuple',
                components: [
                  { name: 'salt', type: 'uint256' },
                  { name: 'expiry', type: 'uint256' },
                  { name: 'nonce', type: 'uint256' },
                  { name: 'orderType', type: 'uint8' },
                  { name: 'token', type: 'address' },
                  { name: 'YT', type: 'address' },
                  { name: 'maker', type: 'address' },
                  { name: 'receiver', type: 'address' },
                  { name: 'makingAmount', type: 'uint256' },
                  { name: 'lnImpliedRate', type: 'uint256' },
                  { name: 'failSafeRate', type: 'uint256' },
                  { name: 'permit', type: 'bytes' }
                ]
              },
              { name: 'signature', type: 'bytes' },
              { name: 'makingAmount', type: 'uint256' }
            ]
          },
          {
            name: 'flashFills',
            type: 'tuple[]',
            components: [
              {
                name: 'order',
                type: 'tuple',
                components: [
                  { name: 'salt', type: 'uint256' },
                  { name: 'expiry', type: 'uint256' },
                  { name: 'nonce', type: 'uint256' },
                  { name: 'orderType', type: 'uint8' },
                  { name: 'token', type: 'address' },
                  { name: 'YT', type: 'address' },
                  { name: 'maker', type: 'address' },
                  { name: 'receiver', type: 'address' },
                  { name: 'makingAmount', type: 'uint256' },
                  { name: 'lnImpliedRate', type: 'uint256' },
                  { name: 'failSafeRate', type: 'uint256' },
                  { name: 'permit', type: 'bytes' }
                ]
              },
              { name: 'signature', type: 'bytes' },
              { name: 'makingAmount', type: 'uint256' }
            ]
          },
          { name: 'optData', type: 'bytes' }
        ]
      }
    ],
    outputs: [
      { name: 'netTokenOut', type: 'uint256' },
      { name: 'netSyFee', type: 'uint256' },
      { name: 'netSyInterm', type: 'uint256' }
    ]
  },
  {
    type: 'function',
    name: 'exitPostExpToToken',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'market', type: 'address' },
      { name: 'netPtIn', type: 'uint256' },
      { name: 'netLpIn', type: 'uint256' },
      {
        name: 'output',
        type: 'tuple',
        components: [
          { name: 'tokenOut', type: 'address' },
          { name: 'minTokenOut', type: 'uint256' },
          { name: 'tokenRedeemSy', type: 'address' },
          { name: 'pendleSwap', type: 'address' },
          {
            name: 'swapData',
            type: 'tuple',
            components: [
              { name: 'swapType', type: 'uint8' },
              { name: 'extRouter', type: 'address' },
              { name: 'extCalldata', type: 'bytes' },
              { name: 'needScale', type: 'bool' }
            ]
          }
        ]
      }
    ],
    // Real signature: returns (uint256 netTokenOut, ExitPostExpReturnParams params)
    // where ExitPostExpReturnParams is a 5-field struct. Flattened by viem at
    // decode time, so the wire layout is 6 × uint256 = 192 bytes. Mismatching
    // this (e.g. the older 7-field shape from earlier Pendle versions) makes
    // viem's `simulateContract` throw "Position 192 is out of bounds" since it
    // tries to read past the actual return data length. Verified against
    // pendle-core-v2-public IPAllActionTypeV3.sol.
    outputs: [
      { name: 'netTokenOut', type: 'uint256' },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'netPtFromRemove', type: 'uint256' },
          { name: 'netSyFromRemove', type: 'uint256' },
          { name: 'netPtRedeem', type: 'uint256' },
          { name: 'netSyFromRedeem', type: 'uint256' },
          { name: 'totalSyOut', type: 'uint256' }
        ]
      }
    ]
  }
] as const;

/** Per-flow allowlist — the only selectors usePendleConvert will sign. */
export const PENDLE_ALLOWED_SELECTORS = {
  buy: ['swapExactTokenForPt'] as const,
  withdraw: ['swapExactPtForToken', 'exitPostExpToToken'] as const
};

// ---------------------------------------------------------------------------
// Empty-struct constants matching Pendle's StructGen.sol reference.
// These are what every "no aggregator, no limit orders" call must use.
// ---------------------------------------------------------------------------

/** Mirrors `SwapData public emptySwap;` in StructGen.sol */
export const PENDLE_EMPTY_SWAP_DATA = {
  swapType: 0,
  extRouter: ZERO_ADDRESS,
  extCalldata: '0x' as `0x${string}`,
  needScale: false
} as const;

/** Mirrors `LimitOrderData public emptyLimit;` in StructGen.sol */
export const PENDLE_EMPTY_LIMIT = {
  limitRouter: ZERO_ADDRESS,
  epsSkipMarket: 0n,
  normalFills: [] as const,
  flashFills: [] as const,
  optData: '0x' as `0x${string}`
} as const;

// ---------------------------------------------------------------------------
// Markets — single source of truth for which Pendle markets we support.
// Adding a market is a pure config change.
// ---------------------------------------------------------------------------

export const PENDLE_MARKETS: PendleMarketConfig[] = [
  {
    // PT-sUSDS-26NOV2026 — underlying is sUSDS (Pendle's underlyingAsset = SY's
    // wrapped yield-bearing token). PT redeems to 1 USDS at maturity per
    // SY.assetInfo (assetType=0 TOKEN, USDS), so usdsEquivalence is 'pegged'.
    name: 'PT-sUSDS',
    marketAddress: '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc',
    ptToken: '0xdc169abe56461a2e0c034da431ac2a3ebf596094',
    ytToken: '0xc7b8551c6b286ce0b44952320e940bd3dee58a09',
    syToken: '0xbe3d4ec488a0a042bb86f9176c24f8cd54018ba7',
    underlyingToken: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD',
    underlyingSymbol: 'sUSDS',
    underlyingDecimals: 18,
    // SY-sUSDS.getTokensIn() == getTokensOut() == [DAI, USDS, sUSDS]. USDS and
    // DAI route through SY directly (no aggregator); USDC needs the aggregator.
    syAcceptedTokens: [
      '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
      '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD'
    ],
    expiry: 1795651200, // Thu Nov 26 2026 00:00:00 UTC
    usdsEquivalence: 'pegged'
  }
];

export function getPendleMarketByAddress(address: `0x${string}`): PendleMarketConfig | undefined {
  const lower = address.toLowerCase();
  return PENDLE_MARKETS.find(m => m.marketAddress.toLowerCase() === lower);
}
