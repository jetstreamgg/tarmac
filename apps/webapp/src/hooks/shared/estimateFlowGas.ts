import { publicActionsL2 } from 'viem/op-stack';
import type { Address, Call, Hex, PublicClient } from 'viem';
import {
  EIP7702_AUTH_COST,
  encodeBatchExecutorData,
  getBatchGasFloor,
  getCallData,
  isDelegated,
  isOpStackChain,
  totalCallValue
} from './networkFee';
import { getBatchExecutorCode } from './batchExecutorCode';

export type FlowGasEstimate = {
  /** Cost of signing the calls one at a time: N intrinsics, N cold-access sets. */
  sequentialGas: bigint;
  /** Cost of the same calls as one bundled transaction, or undefined when not applicable. */
  batchGas?: bigint;
  /**
   * The bundled cost an account that has already delegated would pay — i.e. `batchGas`
   * without the one-time authorization tuple. The saving is quoted from this: a first
   * bundle can genuinely cost more than the sequence, but every bundle after it saves,
   * so advertising the first-run penalty would misrepresent the feature.
   */
  batchGasSteadyState?: bigint;
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
 * delegate. Measured against MetaMask's delegate the stand-in agrees to ~0.1% (154,612 vs
 * 154,804 for an approve+deposit), so asking the real delegate buys nothing — while
 * Ambire's delegate returns *success* from an ERC-7821 `execute` it doesn't implement and
 * reports ~31,000 gas for the same work, which we would otherwise have shown as a 5x-too-
 * cheap fee. One code path, no assumptions about a wallet's ABI. The executor's code is
 * embedded (see multicall3RuntimeCode.ts), so the only read is the account's own code,
 * which decides whether the authorization tuple still has to be paid.
 */
async function simulateBundledGas(
  client: PublicClient,
  chainId: number,
  account: Address,
  calls: readonly Call[]
): Promise<{ gas: bigint; steadyStateGas: bigint }> {
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
  return {
    gas: isDelegated(accountCode) ? result.gasUsed : result.gasUsed + EIP7702_AUTH_COST,
    steadyStateGas: result.gasUsed
  };
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
  // The bundled branch catches its own failures: it is the optional figure, and letting
  // it reject the pair blanked the sequential fee too — the one the row falls back to.
  const [perCallGas, simulatedBatchGas] = await Promise.all([
    simulateSequential(client, account, calls),
    wantsBatch
      ? simulateBundledGas(client, chainId, account, calls).catch(() => undefined)
      : Promise.resolve(undefined)
  ]);

  const sequentialGas = perCallGas.reduce((total, gas) => total + gas, 0n);
  // A bundle cheaper than its own most expensive call did not execute the calls. Drop it
  // rather than price it, and the caller falls back to the sequential figure.
  const trustworthy =
    simulatedBatchGas !== undefined && simulatedBatchGas.gas >= getBatchGasFloor(perCallGas);
  const batchGas = trustworthy ? simulatedBatchGas!.gas : undefined;
  const batchGasSteadyState = trustworthy ? simulatedBatchGas!.steadyStateGas : undefined;

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
    batchGasSteadyState,
    sequentialL1Fee: sequentialL1Fees.reduce((total, fee) => total + fee, 0n),
    batchL1Fee
  };
}
