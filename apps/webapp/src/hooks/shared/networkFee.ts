import { encodeFunctionData, formatEther, parseAbi, type Call, type Hex } from 'viem';

import { base, optimism, unichain } from 'wagmi/chains';

/**
 * Canonical Multicall3 deployment — byte-identical runtime code at this address on
 * every chain the app supports (verified: mainnet, Base, Arbitrum, Optimism, Unichain).
 *
 * We never call it directly. Calling it would make Multicall3 the `msg.sender` of the
 * inner calls, which breaks any allowance or balance the flow depends on. Instead we
 * copy its code into a `stateOverrides` entry at the *user's own address*, so the batch
 * executes exactly the way an EIP-7702 delegate would — one intrinsic gas charge, and
 * storage warm across the inner calls. That is what a summed per-call estimate cannot
 * model, and it is the whole reason a bundle is cheaper than the sequence.
 */
export const BATCH_EXECUTOR_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

/** Code at an EIP-7702-delegated EOA is the indicator `0xef0100` followed by the delegate address. */
const DELEGATION_INDICATOR_PREFIX = '0xef0100';

/**
 * Intrinsic cost of the authorization tuple a wallet attaches the first time it delegates
 * an account (EIP-7702 `PER_AUTH_BASE_COST`). Only the first bundle from a given account
 * pays it, which is the difference between an ~18% and an ~12% saving on a 2-call flow.
 */
export const EIP7702_AUTH_COST = 12_500n;

/** Intrinsic cost every transaction pays before executing a single opcode. */
const INTRINSIC_GAS = 21_000n;

/**
 * Smallest gas a genuine bundle of these calls could possibly use.
 *
 * A bundle still performs the work of its most expensive call; all it saves is that
 * call's *siblings'* intrinsic and cold-access charges. So the largest single call, less
 * its own intrinsic, is a hard floor — and a cheap way to catch a batch simulation that
 * reported success without doing the work. Ambire's 7702 delegate does exactly that: it
 * returns success from an ERC-7821 `execute` it does not implement, and 31,180 gas for an
 * approve+deposit that really costs ~148,000. Anything under the floor is not a price.
 */
export function getBatchGasFloor(perCallGas: readonly bigint[]): bigint {
  const largest = perCallGas.reduce((max, gas) => (gas > max ? gas : max), 0n);
  return largest > INTRINSIC_GAS ? largest - INTRINSIC_GAS : 0n;
}

/**
 * OP-stack chains bill an L1 data fee on top of L2 execution, and `eth_estimateGas`
 * covers only the latter. Arbitrum is deliberately absent: it already inflates the gas
 * units it returns to cover its L1 component, so adding a surcharge there double-counts.
 */
const OP_STACK_CHAIN_IDS: readonly number[] = [base.id, optimism.id, unichain.id];

export const isOpStackChain = (chainId: number): boolean => OP_STACK_CHAIN_IDS.includes(chainId);

const multicall3Abi = parseAbi([
  'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])',
  'function aggregate3Value((address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])'
]);

/**
 * Calldata for a call in either form viem's `Call` accepts.
 *
 * The engines build calls through `getWriteContractCall`, which keeps the *contract*
 * form (`{ to, abi, functionName, args }`) and lets viem encode at send time. Anywhere
 * we hand calldata to something other than `simulateCalls` — the batch encoders, the L1
 * data-fee estimate, the cache key — it has to be encoded here first, or the inner calls
 * come out empty.
 */
export function getCallData(call: Call): Hex {
  if ('data' in call && call.data) return call.data;
  if ('abi' in call && 'functionName' in call && call.abi && call.functionName) {
    return encodeFunctionData({
      abi: call.abi,
      functionName: call.functionName,
      args: 'args' in call ? call.args : undefined
    });
  }
  return '0x';
}

/**
 * True when `code` is an EIP-7702 delegation indicator. A delegated account lets us
 * simulate against the wallet's real delegate rather than a stand-in, and tells us the
 * authorization cost has already been paid.
 */
export function isDelegated(code: Hex | undefined): boolean {
  return !!code && code.toLowerCase().startsWith(DELEGATION_INDICATOR_PREFIX);
}

/** Calldata for the stand-in executor. `aggregate3Value` only when a call carries ETH. */
export function encodeBatchExecutorData(calls: readonly Call[]): Hex {
  const hasValue = calls.some(call => !!call.value);
  return hasValue
    ? encodeFunctionData({
        abi: multicall3Abi,
        functionName: 'aggregate3Value',
        args: [
          calls.map(call => ({
            target: call.to,
            allowFailure: false,
            value: call.value ?? 0n,
            callData: getCallData(call)
          }))
        ]
      })
    : encodeFunctionData({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        args: [calls.map(call => ({ target: call.to, allowFailure: false, callData: getCallData(call) }))]
      });
}

/** Total ETH a batch must carry — the sum of its calls' values. */
export function totalCallValue(calls: readonly Call[]): bigint {
  return calls.reduce((total, call) => total + (call.value ?? 0n), 0n);
}

/**
 * Stable cache key for a flow. Keyed on the encoded calldata rather than on the input
 * amount, so it is correct by construction: two flows that differ only in a branch the
 * calldata doesn't capture cannot collide.
 */
export function getCallsKey(calls: readonly Call[]): string {
  return calls.map(call => `${call.to}:${getCallData(call)}:${call.value ?? 0n}`).join('|');
}

/**
 * Blocks of history sampled to price a transaction, and the percentile of the priority
 * fees paid in them that we bill at.
 *
 * The percentile is not a guess. `eth_maxPriorityFeePerGas` reports what it takes to get
 * included *at all* — on the Sky proxy it returned 0.000426 gwei — while wallets bid for
 * prompt inclusion, and when the base fee is ~0.1 gwei the tip IS the price. A real
 * MetaMask batch (0xb2d7c987…) paid a 2.0 gwei tip against a 0.1 gwei base: 2.1007 gwei
 * total, where the base-fee-driven estimate said 0.136 — understating the fee 15x.
 * Measured over the 40 blocks around it, the median p95 tip reproduces what that
 * transaction actually paid to within 1% (p90 reaches only 69%, p99 overshoots to 106%).
 */
export const FEE_HISTORY_BLOCK_COUNT = 20;
export const PRIORITY_FEE_PERCENTILE = 95;

const median = (values: bigint[]): bigint => {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)];
};

/**
 * The price a transaction sent now would most likely pay: next block's base fee plus a
 * representative tip.
 *
 * This is the *expected* price, not a `maxFeePerGas` ceiling — the row states what the
 * transaction costs, and the wallet still sets the actual bid.
 */
export function computeFeePerGas(feeHistory: {
  baseFeePerGas: readonly bigint[];
  reward?: readonly (readonly bigint[])[];
}): bigint {
  // `eth_feeHistory` returns blockCount + 1 base fees; the last is the *next* block's,
  // which is the one a transaction sent now would actually pay.
  const nextBaseFee = feeHistory.baseFeePerGas.at(-1) ?? 0n;
  const tip = median((feeHistory.reward ?? []).map(blockRewards => blockRewards[0] ?? 0n));
  return nextBaseFee + tip;
}

/** Wei cost of a transaction: execution gas at the current price, plus any L1 data fee. */
export function computeFeeWei({
  gas,
  feePerGas,
  l1Fee = 0n
}: {
  gas: bigint;
  feePerGas: bigint;
  l1Fee?: bigint;
}): bigint {
  return gas * feePerGas + l1Fee;
}

/** Fee in USD, or undefined when we have no ETH price to convert with. */
export function feeWeiToUsd(feeWei: bigint, ethPrice: number | undefined): number | undefined {
  if (ethPrice === undefined || !Number.isFinite(ethPrice)) return undefined;
  return Number(formatEther(feeWei)) * ethPrice;
}

/**
 * Proportion of the sequential cost a bundle saves. Returned as a ratio (0.184 = 18.4%).
 *
 * Deliberately gas-denominated, not USD: the gas price and ETH price cancel out of the
 * quotient, so this is stable between blocks and immune to the largest source of error
 * in either dollar figure. The saving UI is not built yet (APP-418 defers it), but this
 * is the number it should be built on.
 */
export function computeBatchSaving(sequentialGas: bigint, batchGas: bigint | undefined): number | undefined {
  if (batchGas === undefined || sequentialGas <= 0n || batchGas >= sequentialGas) return undefined;
  return 1 - Number(batchGas) / Number(sequentialGas);
}
