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
 * Subset of `action` values from the /transactions endpoint we surface in
 * trade history. The endpoint also returns BUY_YT, SELL_YT, LONG_YIELD,
 * SHORT_YIELD, ADD_LIQUIDITY, REMOVE_LIQUIDITY — those are filtered out.
 */
export enum PendleTradeAction {
  BUY_PT = 'BUY_PT',
  SELL_PT = 'SELL_PT'
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
  },
  {
    // Pendle Router V4 native multicall — bundles N inner calls to the same
    // Router into one tx. Used by useBatchPendleRedeemAll to redeem
    // multiple matured positions atomically with a single signature. Each
    // inner blob is independently selector-allowlist verified before being
    // wrapped here (see buildMulticallVerifiedArgs).
    //
    // Signature must match Pendle's ActionMiscV3.multicall exactly:
    //   function multicall(Call3[] calls) returns (Result[])
    //   struct Call3  { bool allowFailure; bytes callData; }
    //   struct Result { bool success; bytes returnData; }
    // Mismatching the signature (e.g. multicall(bytes[])) hits a different
    // 4-byte selector and the call reverts at simulation time.
    type: 'function',
    name: 'multicall',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' }
        ]
      }
    ],
    outputs: [
      {
        name: 'res',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' }
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

/**
 * Initial integration uses PT-USDG for testing. Production launch market(s) will
 * be added here once chosen by the team.
 *
 * On-chain readout (Apr 2026):
 *   Market   0xc5b32dba5f29f8395fb9591e1a15f23a75214f33
 *   SY       0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927  ("SY Global Dollar")
 *   PT       0x9db38D74a0D29380899aD354121DfB521aDb0548
 *   YT       0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1
 *   USDG     0xe343167631d89B6Ffc58B88d6b7fB0228795491D  (only token in/out)
 *   Expiry   1779926400 (Thu May 28 2026 00:00:00 UTC)
 */
export const PENDLE_MARKETS: PendleMarketConfig[] = [
  {
    name: 'PT-USDG',
    marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
    ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548',
    ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1',
    syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927',
    underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
    underlyingSymbol: 'USDG',
    underlyingDecimals: 6,
    expiry: 1779926400 // Thu May 28 2026 00:00:00 UTC
  },
  {
    name: 'PT-USDe',
    marketAddress: '0xa3336f04f7afbf26714331e395054f33b77c9b8d',
    ptToken: '0xAeBf0Bb9f57E89260d57f31AF34eB58657d96Ce0',
    ytToken: '0x4265ebF36F738D4D623C201BecBbc0f92bE57198',
    syToken: '0xf0bAcD9C3D94fC924DBcaaF644208C4E3f4d3bB4',
    underlyingToken: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
    underlyingSymbol: 'USDe',
    underlyingDecimals: 18,
    expiry: 1778112000
  },
  {
    name: 'PT-sENA',
    marketAddress: '0xeab7b7c8353ba1cb4b29cf7ae9c166efdc57835f',
    ptToken: '0x4552C668eb8dEDeAc53e00CfD05d873f11a80204',
    ytToken: '0xF8a735034Ce8eBec8f6A742658460a78Ebfae725',
    syToken: '0xA36ECCA8B7624D224F01CD6649C8afAd3Da12C3D',
    underlyingToken: '0x8bE3460A480c80728a8C4D7a5D5303c85ba7B3b9',
    underlyingSymbol: 'sENA',
    underlyingDecimals: 18,
    expiry: 1777507200
  }
];

export function getPendleMarketByAddress(address: `0x${string}`): PendleMarketConfig | undefined {
  const lower = address.toLowerCase();
  return PENDLE_MARKETS.find(m => m.marketAddress.toLowerCase() === lower);
}
