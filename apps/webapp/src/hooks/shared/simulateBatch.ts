import {
  BaseError,
  decodeErrorResult,
  decodeFunctionResult,
  getAbiItem,
  type Address,
  type Call,
  type Hex,
  type PublicClient
} from 'viem';
import { extractErrorCode } from '../helpers';
import { encodeBatchExecutorData, getCallData, multicall3Abi, totalCallValue } from './networkFee';
import { getBatchExecutorCode } from './batchExecutorCode';

/**
 * Why a batch simulation failed.
 *
 * - `reverted`: the bundle executed and a sub-call failed — a real answer about the
 *   calls (bad allowance, halted contract, a target with no code). Deterministic:
 *   retrying changes nothing until the inputs do.
 * - `structural`: the RPC will not run this kind of simulation at all — it rejected the
 *   state-override parameter or the method. Also deterministic, but says nothing about
 *   the calls; the sequential path (plain per-call `eth_call`) is still available.
 * - `transient`: the request itself failed (network, rate limit, a 5xx). Retry.
 */
export type BatchSimulationFailureKind = 'reverted' | 'structural' | 'transient';

/** One sub-call's outcome, as Multicall3 reports it. */
export type BatchCallResult = { success: boolean; returnData: Hex };

export class BatchSimulationError extends Error {
  override readonly name = 'BatchSimulationError';
  readonly kind: BatchSimulationFailureKind;
  /** Index of the failed sub-call, when a specific one failed. */
  readonly callIndex?: number;

  constructor(
    message: string,
    { kind, callIndex, cause }: { kind: BatchSimulationFailureKind; callIndex?: number; cause?: unknown }
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.kind = kind;
    this.callIndex = callIndex;
  }
}

export function isBatchSimulationError(error: unknown): error is BatchSimulationError {
  return error instanceof BatchSimulationError;
}

export const isStructuralBatchSimulationError = (error: unknown): boolean =>
  isBatchSimulationError(error) && error.kind === 'structural';

export const isTransientBatchSimulationError = (error: unknown): boolean =>
  isBatchSimulationError(error) && error.kind === 'transient';

/**
 * JSON-RPC codes that mean "this server does not do that": invalid params (the override
 * object), method not found / not supported, and Tenderly's "resource not found" for an
 * unknown method. Anything else is treated as a request that might succeed next time.
 */
const STRUCTURAL_RPC_CODES = new Set([-32602, -32601, -32004, -32001]);
const STRUCTURAL_MESSAGE = /state ?override|not supported|unsupported|invalid param|method not found/i;

function classifyRpcFailure(error: unknown): BatchSimulationFailureKind {
  const code = extractErrorCode(error);
  if (code !== undefined && STRUCTURAL_RPC_CODES.has(code)) return 'structural';
  const message = error instanceof BaseError ? error.shortMessage : String((error as Error)?.message ?? '');
  if (STRUCTURAL_MESSAGE.test(message)) return 'structural';
  return 'transient';
}

/**
 * True when a sub-call reported success but handed back nothing, although its ABI says
 * it returns something. Solidity always returns its declared outputs, so the only ways
 * to get `0x` here are a target with no code (a raw CALL to an empty address succeeds
 * and returns nothing) or a fallback that swallowed the selector. Both mean the call did
 * not do what the app thinks it did — the wrong-chain address-map miss that motivated
 * the chain guard (APP-528) lands exactly here. Output-less functions can't be told
 * apart this way, which is why the guard stays the primary defence.
 */
function returnedNothingDespiteOutputs(call: Call, returnData: Hex): boolean {
  if (returnData !== '0x') return false;
  if (!('abi' in call) || !call.abi || !('functionName' in call) || !call.functionName) return false;
  const item = getAbiItem({
    abi: call.abi,
    name: call.functionName,
    args: 'args' in call ? call.args : undefined
  });
  return !!item && item.type === 'function' && item.outputs.length > 0;
}

/**
 * The revert reason of a failed sub-call, decoded with that call's own ABI so custom
 * errors read by name. viem falls back to the built-in `Error(string)` and `Panic(uint)`
 * shapes on its own, and anything it can't decode is shown as the raw selector.
 */
function describeRevert(call: Call, returnData: Hex): string {
  if (returnData === '0x') return 'reverted without a reason';
  try {
    const decoded = decodeErrorResult({
      abi: 'abi' in call && call.abi ? call.abi : [],
      data: returnData
    });
    if (decoded.errorName === 'Error' && decoded.args?.length === 1) return String(decoded.args[0]);
    if (decoded.errorName === 'Panic' && decoded.args?.length === 1)
      return `Panic(${String(decoded.args[0])})`;
    const args = decoded.args
      ?.map(arg => (typeof arg === 'bigint' ? arg.toString() : String(arg)))
      .join(', ');
    return `${decoded.errorName}(${args ?? ''})`;
  } catch {
    return `reverted with data ${returnData.slice(0, 10)}`;
  }
}

function describeCall(call: Call, index: number): string {
  const name =
    'functionName' in call && call.functionName ? String(call.functionName) : getCallData(call).slice(0, 10);
  return `call ${index + 1} (${name} on ${call.to})`;
}

/**
 * Validate a batch before the wallet sees it.
 *
 * One `eth_call` runs the whole bundle atomically: the batch executor's runtime code
 * (Multicall3, read from its canonical deployment on this chain) is placed at the user's
 * own address through a state override, so every inner call sees
 * `msg.sender == account` — the same thing the wallet's EIP-7702 delegate arranges at
 * send time — and an approve primes the allowance for the deposit that follows it in
 * the same call. Nothing is sent, and no real delegate is consulted (see networkFee.ts
 * for why the stand-in, not the wallet's delegate).
 *
 * Resolves with each sub-call's `(success, returnData)` on a clean bundle. Throws a
 * `BatchSimulationError` otherwise, whose `kind` says whether the calls are wrong, the
 * RPC can't do this, or the request just failed.
 */
export async function simulateBatch({
  client,
  chainId,
  account,
  calls
}: {
  client: PublicClient;
  chainId: number;
  account: Address;
  calls: readonly Call[];
}): Promise<readonly BatchCallResult[]> {
  let executorCode: Hex | undefined;
  try {
    executorCode = await getBatchExecutorCode(client, chainId);
  } catch (error) {
    throw new BatchSimulationError('Batch simulation failed: could not read the batch executor code', {
      kind: 'transient',
      cause: error
    });
  }
  // No Multicall3 on this chain: nothing to stand in for the delegate, so a bundle can't
  // be validated here. Says nothing about the calls.
  if (!executorCode) {
    throw new BatchSimulationError('Batch simulation unavailable: no batch executor deployed on this chain', {
      kind: 'structural'
    });
  }

  let data: Hex | undefined;
  try {
    ({ data } = await client.call({
      account,
      to: account,
      data: encodeBatchExecutorData(calls, { allowFailure: true }),
      value: totalCallValue(calls),
      stateOverride: [{ address: account, code: executorCode }]
    }));
  } catch (error) {
    // With failures allowed, the outer call only reverts for bundle-level reasons
    // (Multicall3's own value-mismatch check, out of gas) — a revert nonetheless.
    const kind = isExecutionRevert(error) ? 'reverted' : classifyRpcFailure(error);
    const detail =
      error instanceof BaseError ? error.shortMessage : String((error as Error)?.message ?? error);
    throw new BatchSimulationError(`Batch simulation failed: ${detail}`, { kind, cause: error });
  }

  // A call to an address with no code returns nothing: an empty result means the
  // override was accepted but not applied, and this RPC can't validate a bundle.
  if (!data) {
    throw new BatchSimulationError('Batch simulation returned no data: the RPC ignored the code override', {
      kind: 'structural'
    });
  }

  const results = decodeFunctionResult({
    abi: multicall3Abi,
    functionName: totalCallValue(calls) > 0n ? 'aggregate3Value' : 'aggregate3',
    data
  });

  results.forEach((result, index) => {
    const call = calls[index];
    if (!result.success) {
      throw new BatchSimulationError(
        `Batch simulation: ${describeCall(call, index)} ${describeRevert(call, result.returnData)}`,
        { kind: 'reverted', callIndex: index }
      );
    }
    if (returnedNothingDespiteOutputs(call, result.returnData)) {
      throw new BatchSimulationError(
        `Batch simulation: ${describeCall(call, index)} returned no data — the target has no code on this chain`,
        { kind: 'reverted', callIndex: index }
      );
    }
  });

  return results;
}

/** viem reports an `eth_call` revert with JSON-RPC code 3 (`ExecutionRevertedError`). */
function isExecutionRevert(error: unknown): boolean {
  if (extractErrorCode(error) === 3) return true;
  const message = error instanceof BaseError ? error.shortMessage : '';
  return /execution reverted/i.test(message);
}
