import {
  BaseError,
  decodeErrorResult,
  decodeFunctionResult,
  getAbiItem,
  InsufficientFundsError,
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
 *   state-override parameter or the method, or accepted the override and ignored it.
 *   Also deterministic, but says nothing about the calls; the sequential path (plain
 *   per-call `eth_call`) is still available.
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
  if (STRUCTURAL_MESSAGE.test(nodeMessage(error))) return 'structural';
  return 'transient';
}

/**
 * What the node itself said. Not viem's `shortMessage`: that is viem's canned text for
 * the error class, and the class it picks for an unrecognised -32000 ("header not
 * found", a timeout) reads "Missing or invalid parameters." — which would pass for an
 * override rejection. viem keeps the node's own words in `details`.
 */
function nodeMessage(error: unknown): string {
  const parts: string[] = [];
  let e: unknown = error;
  for (let i = 0; i < 10 && e; i++) {
    if (e instanceof BaseError) {
      if (e.details) parts.push(e.details);
    } else if (e instanceof Error) {
      parts.push(e.message);
    }
    e = (e as { cause?: unknown }).cause;
  }
  return parts.join('\n');
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
 * (Multicall3, read from a canonical deployment) is placed at the user's
 * own address through a state override, so every inner call sees
 * `msg.sender == account` — the same thing the wallet's EIP-7702 delegate arranges at
 * send time — and an approve primes the allowance for the deposit that follows it in
 * the same call. Nothing is sent, and no real delegate is consulted (see networkFee.ts
 * for why the stand-in, not the wallet's delegate).
 *
 * Resolves with each sub-call's `(success, returnData)` on a clean bundle. Throws a
 * `BatchSimulationError` otherwise, whose `kind` says whether the calls are wrong, the
 * RPC can't do this, or the request just failed.
 *
 * Limits, for whoever first bundles native ETH or NFTs (no flow does today):
 * - The account runs Multicall3's code for the simulation, and Multicall3 has no
 *   `receive`/`fallback` and no `onERC721Received`/`onERC1155Received`. A call that
 *   pays ETH out to the user, or `safeTransfer`s an NFT to them, reverts here although
 *   the wallet's real delegate would accept it — a false red.
 * - Nothing checks the ETH `value` against the balance. Many nodes don't check it on
 *   `eth_call` either; one that does answers "insufficient funds", which reads as a
 *   revert.
 */
export async function simulateBatch({
  client,
  account,
  calls,
  fallbackClients
}: {
  client: PublicClient;
  account: Address;
  calls: readonly Call[];
  /** Other chains to read the executor code from when this one has no deployment. */
  fallbackClients?: readonly PublicClient[];
}): Promise<readonly BatchCallResult[]> {
  let executorCode: Hex | undefined;
  try {
    executorCode = await getBatchExecutorCode(client, fallbackClients);
  } catch (error) {
    throw new BatchSimulationError('Batch simulation failed: could not read the batch executor code', {
      kind: 'transient',
      cause: error
    });
  }
  // No Multicall3 on any chain we can reach: nothing to stand in for the delegate, so a
  // bundle can't be validated. Says nothing about the calls.
  if (!executorCode) {
    throw new BatchSimulationError('Batch simulation unavailable: no batch executor code found', {
      kind: 'structural'
    });
  }

  // Encoded before the request, so a call that can't be encoded reads as what it is —
  // calls that are wrong, which no retry fixes — and not as a failed request.
  let batchData: Hex;
  try {
    batchData = encodeBatchExecutorData(calls, { allowFailure: true });
  } catch (error) {
    throw new BatchSimulationError('Batch simulation: the calls could not be encoded', {
      kind: 'reverted',
      cause: error
    });
  }

  let data: Hex | undefined;
  try {
    ({ data } = await client.call({
      account,
      to: account,
      data: batchData,
      value: totalCallValue(calls),
      stateOverride: [{ address: account, code: executorCode }]
    }));
  } catch (error) {
    // A node that checks the sender's balance is answering about the inputs. An outer
    // revert is classified by classifyBundleRevert.
    const kind = isInsufficientFunds(error)
      ? 'reverted'
      : isExecutionRevert(error)
        ? classifyBundleRevert(error)
        : classifyRpcFailure(error);
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

  // Anything that doesn't decode as the executor's result means the RPC ran something
  // other than the overridden code — the same verdict as the empty result above.
  let results: readonly BatchCallResult[];
  try {
    results = decodeFunctionResult({
      abi: multicall3Abi,
      functionName: totalCallValue(calls) > 0n ? 'aggregate3Value' : 'aggregate3',
      data
    });
  } catch (error) {
    throw new BatchSimulationError('Batch simulation returned data that is not the batch result', {
      kind: 'structural',
      cause: error
    });
  }
  // One entry per call, or the result isn't the executor's answer to these calls: a
  // short array would pass the calls it leaves out unchecked.
  if (results.length !== calls.length) {
    throw new BatchSimulationError(
      `Batch simulation returned ${results.length} results for ${calls.length} calls`,
      { kind: 'structural' }
    );
  }

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

/**
 * A node that checks the sender's balance for the call's value (most don't on `eth_call`).
 * viem recognises the node's wording and rewrites it into its own `InsufficientFundsError`,
 * whose message no longer says "insufficient funds" — so match the type, not the text.
 */
function isInsufficientFunds(error: unknown): boolean {
  return error instanceof BaseError && error.walk(e => e instanceof InsufficientFundsError) !== null;
}

/**
 * With failures allowed and the value matching the calls', Multicall3 itself does not
 * revert: every sub-call's failure comes back as an entry. An outer revert therefore
 * means Multicall3 was not what ran — the RPC ignored the code override and the
 * account's own code (an EIP-7702 delegate, a smart account: exactly the wallets that
 * bundle) got an `aggregate3` it doesn't implement. That says nothing about the calls.
 * Only Multicall3's own value check is about the inputs.
 */
function classifyBundleRevert(error: unknown): BatchSimulationFailureKind {
  const message = error instanceof BaseError ? `${error.shortMessage}\n${nodeMessage(error)}` : '';
  return /value mismatch/i.test(message) ? 'reverted' : 'structural';
}

/** viem reports an `eth_call` revert with JSON-RPC code 3 (`ExecutionRevertedError`). */
function isExecutionRevert(error: unknown): boolean {
  if (extractErrorCode(error) === 3) return true;
  const message = error instanceof BaseError ? error.shortMessage : '';
  return /execution reverted/i.test(message);
}
