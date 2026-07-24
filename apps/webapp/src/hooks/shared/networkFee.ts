import { encodeAbiParameters, encodeFunctionData, formatEther, parseAbi, type Call, type Hex } from 'viem';
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

/**
 * OP-stack chains bill an L1 data fee on top of L2 execution, and `eth_estimateGas`
 * covers only the latter. Arbitrum is deliberately absent: it already inflates the gas
 * units it returns to cover its L1 component, so adding a surcharge there double-counts.
 */
const OP_STACK_CHAIN_IDS: readonly number[] = [base.id, optimism.id, unichain.id];

export const isOpStackChain = (chainId: number): boolean => OP_STACK_CHAIN_IDS.includes(chainId);

/** ERC-7821 batch mode with no `opData` — the single-batch form every delegate implements. */
const ERC7821_BATCH_MODE = '0x0100000000000000000000000000000000000000000000000000000000000000' as const;

const multicall3Abi = parseAbi([
  'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])',
  'function aggregate3Value((address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])'
]);

const erc7821Abi = parseAbi(['function execute(bytes32 mode, bytes executionData)']);

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
            callData: call.data ?? '0x'
          }))
        ]
      })
    : encodeFunctionData({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        args: [calls.map(call => ({ target: call.to, allowFailure: false, callData: call.data ?? '0x' }))]
      });
}

/** Calldata for a real EIP-7702 delegate that implements ERC-7821 `execute`. */
export function encodeErc7821ExecuteData(calls: readonly Call[]): Hex {
  const executionData = encodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      }
    ],
    [calls.map(call => ({ to: call.to, value: call.value ?? 0n, data: call.data ?? '0x' }))]
  );

  return encodeFunctionData({
    abi: erc7821Abi,
    functionName: 'execute',
    args: [ERC7821_BATCH_MODE, executionData]
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
  return calls.map(call => `${call.to}:${call.data ?? '0x'}:${call.value ?? 0n}`).join('|');
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
