import { publicActionsL2 } from 'viem/op-stack';
import type { Address, Call, Hex, PublicClient } from 'viem';
import {
  BATCH_EXECUTOR_ADDRESS,
  EIP7702_AUTH_COST,
  encodeBatchExecutorData,
  getBatchGasFloor,
  getCallData,
  isDelegated,
  isOpStackChain,
  totalCallValue
} from './networkFee';

export type FlowGasEstimate = {
  /** Cost of signing the calls one at a time: N intrinsics, N cold-access sets. */
  sequentialGas: bigint;
  /** Cost of the same calls as one bundled transaction, or undefined when not applicable. */
  batchGas?: bigint;
  /** L1 data fee in wei for the sequential path (0 outside OP-stack chains). */
  sequentialL1Fee: bigint;
  /** L1 data fee in wei for the batch path (0 outside OP-stack chains). */
  batchL1Fee: bigint;
};

/**
 * Placeholder envelope fields for L1 data-fee estimation. `estimateL1Fee` prices the
 * *serialized* transaction, so only byte-length matters here — and passing these
 * explicitly skips viem's `prepareTransactionRequest`, turning three round trips into
 * one (measured 973ms → 199ms on Base). Real fee values are deliberately not used: they
 * would tie this query to the per-block fee data and force a refetch every block for a
 * component worth a fraction of a cent.
 */
const L1_FEE_ENVELOPE = {
  nonce: 1,
  gas: 500_000n,
  maxFeePerGas: 1_000_000_000n,
  maxPriorityFeePerGas: 1_000_000n,
  type: 'eip1559'
} as const;

async function estimateL1Fee(
  client: PublicClient,
  chainId: number,
  account: Address,
  tx: { to: Address; data: Hex; value: bigint }
): Promise<bigint> {
  if (!isOpStackChain(chainId)) return 0n;
  try {
    return await client.extend(publicActionsL2()).estimateL1Fee({
      ...L1_FEE_ENVELOPE,
      account,
      // The oracle and serialization chain both come from the client's own chain.
      chain: undefined,
      to: tx.to,
      data: tx.data,
      value: tx.value
    });
  } catch {
    // The data fee is a rounding error next to L2 execution; never fail the whole
    // estimate over it.
    return 0n;
  }
}

/**
 * The stand-in executor's runtime code is immutable, so fetch it once per chain per
 * session rather than on every modal open. Keyed by chain even though the bytecode is
 * byte-identical everywhere we deploy — a chain without the deployment must not silently
 * borrow another's code.
 */
const batchExecutorCodeCache = new Map<number, Promise<Hex | undefined>>();

function getBatchExecutorCode(client: PublicClient, chainId: number): Promise<Hex | undefined> {
  const cached = batchExecutorCodeCache.get(chainId);
  if (cached) return cached;

  const pending = client.getCode({ address: BATCH_EXECUTOR_ADDRESS }).catch((error: unknown) => {
    // Don't poison the cache — a transient RPC failure shouldn't disable batch estimation
    // for the rest of the session.
    batchExecutorCodeCache.delete(chainId);
    throw error;
  });
  batchExecutorCodeCache.set(chainId, pending);
  return pending;
}

/**
 * Gas for the calls signed one at a time.
 *
 * Each entry in a `simulateCalls` batch is processed as its own transaction — the
 * EIP-2929 access list resets between them (verified: three identical `balanceOf` calls
 * in one block each cost 28,867) — so summing per-call `gasUsed` is exactly the
 * sequential cost. State *does* carry forward, so an approve still primes the supply
 * that follows it.
 */
async function simulateSequential(
  client: PublicClient,
  account: Address,
  calls: readonly Call[]
): Promise<bigint[]> {
  const { results } = await client.simulateCalls({ account, calls });

  return results.map(result => {
    if (result.status === 'failure') {
      throw new Error('Network fee estimation failed: a call reverted in simulation');
    }
    return result.gasUsed;
  });
}

/**
 * Gas for the same calls as one bundled transaction.
 *
 * Always modelled with the stand-in executor, never by calling the account's real 7702
 * delegate. Measured against MetaMask's delegate the stand-in agrees to 0.05% (148,003 vs
 * 148,070 for an approve+deposit), so asking the real delegate buys nothing — while
 * Ambire's delegate returns *success* from an ERC-7821 `execute` it doesn't implement and
 * reports 31,180 gas for the same work, which we would otherwise have shown as a 5x-too-
 * cheap fee. One code path, no assumptions about a wallet's ABI.
 */
async function simulateBatch(
  client: PublicClient,
  chainId: number,
  account: Address,
  calls: readonly Call[]
): Promise<bigint> {
  const [accountCode, executorCode] = await Promise.all([
    client.getCode({ address: account }),
    getBatchExecutorCode(client, chainId)
  ]);

  if (!executorCode) {
    throw new Error('Network fee estimation failed: batch executor code unavailable');
  }

  const { results } = await client.simulateCalls({
    account,
    calls: [{ to: account, data: encodeBatchExecutorData(calls), value: totalCallValue(calls) }],
    stateOverrides: [{ address: account, code: executorCode }]
  });

  const [result] = results;
  if (!result || result.status === 'failure') {
    throw new Error('Network fee estimation failed: the bundled call reverted in simulation');
  }

  // An account that has never delegated pays for the authorization tuple on its first bundle.
  return isDelegated(accountCode) ? result.gasUsed : result.gasUsed + EIP7702_AUTH_COST;
}

/**
 * Estimate what a flow costs both ways.
 *
 * The two simulations are issued as separate concurrent requests on purpose. Blocks
 * inside a single `eth_simulateV1` carry state forward, so running both in one request
 * would let whichever executed first prime storage slots for the other and skew it.
 * Run in parallel, the pair costs the same wall clock as one (~270ms measured).
 */
export async function estimateFlowGas({
  client,
  chainId,
  account,
  calls,
  wantsBatch
}: {
  client: PublicClient;
  chainId: number;
  account: Address;
  calls: readonly Call[];
  wantsBatch: boolean;
}): Promise<FlowGasEstimate> {
  const [perCallGas, simulatedBatchGas] = await Promise.all([
    simulateSequential(client, account, calls),
    wantsBatch ? simulateBatch(client, chainId, account, calls) : Promise.resolve(undefined)
  ]);

  const sequentialGas = perCallGas.reduce((total, gas) => total + gas, 0n);
  // A bundle cheaper than its own most expensive call did not execute the calls. Drop it
  // rather than price it, and the caller falls back to the sequential figure.
  const batchGas =
    simulatedBatchGas !== undefined && simulatedBatchGas >= getBatchGasFloor(perCallGas)
      ? simulatedBatchGas
      : undefined;

  const [sequentialL1Fees, batchL1Fee] = await Promise.all([
    Promise.all(
      calls.map(call =>
        estimateL1Fee(client, chainId, account, {
          to: call.to,
          data: getCallData(call),
          value: call.value ?? 0n
        })
      )
    ),
    batchGas === undefined
      ? Promise.resolve(0n)
      : estimateL1Fee(client, chainId, account, {
          to: account,
          data: encodeBatchExecutorData(calls),
          value: totalCallValue(calls)
        })
  ]);

  return {
    sequentialGas,
    batchGas,
    sequentialL1Fee: sequentialL1Fees.reduce((total, fee) => total + fee, 0n),
    batchL1Fee
  };
}
