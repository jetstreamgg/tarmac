import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  type Abi,
  type DecodeErrorResultReturnType,
  type Hex
} from 'viem';

/**
 * A contract revert, reduced to the one string that identifies it: the
 * `Error(string)` reason ("LockstakeEngine/urn-unsafe"), a custom error's name
 * ("InsufficientLiquidity"), `Panic(<code>)`, or the bare selector of a custom
 * error no ABI at hand could name. It is the registry key in ./index.ts.
 *
 * Custom-error arguments are left out on purpose: they can carry addresses and
 * amounts, and the reason travels to Sentry.
 */
export type DecodedRevert = {
  reason: string;
  kind: 'error' | 'custom' | 'panic' | 'unknown';
};

/** Longest reason passed on. A contract decides the string, so it gets a ceiling. */
const MAX_REASON_LENGTH = 160;

const clamp = (reason: string) =>
  reason.length > MAX_REASON_LENGTH ? `${reason.slice(0, MAX_REASON_LENGTH)}…` : reason;

/** An `Error(string)` reason, or nothing when the contract gave an empty one (`require(x, "")`). */
const errorReason = (value: unknown): DecodedRevert | undefined => {
  const reason = String(value).trim();
  return reason ? { reason: clamp(reason), kind: 'error' } : undefined;
};

/** viem's decoded error, reduced to its registry key. */
function fromDecoded({
  errorName,
  args
}: Pick<DecodeErrorResultReturnType, 'errorName' | 'args'>): DecodedRevert | undefined {
  if (errorName === 'Error' && args?.length === 1) return errorReason(args[0]);
  if (errorName === 'Panic' && args?.length === 1) {
    return { reason: `Panic(0x${(args[0] as bigint).toString(16)})`, kind: 'panic' };
  }
  return { reason: errorName, kind: 'custom' };
}

/**
 * Decodes raw revert data. viem knows the built-in `Error(string)` and
 * `Panic(uint256)` shapes on its own; `abi` names custom errors. Data that
 * still doesn't decode keeps its 4-byte selector.
 */
export function decodeRevertData(data: Hex, abi: Abi | readonly unknown[] = []): DecodedRevert | undefined {
  if (data === '0x' || data.length < 10) return undefined;
  try {
    return fromDecoded(decodeErrorResult({ abi: abi as Abi, data }));
  } catch {
    return { reason: data.slice(0, 10), kind: 'unknown' };
  }
}

/**
 * Carried by errors that already decoded their revert (`BatchSimulationError`, the
 * refused-batch error). Present but `undefined` means "no revert about the user's
 * calls": nothing further down the chain is read.
 */
type WithRevert = { revert?: DecodedRevert };

/**
 * Only what viem decoded from revert data. Not its `reason` on its own: without
 * data viem fills that from the node's or wallet's message ("execution
 * reverted", "Internal JSON-RPC error."), which is no reason at all.
 */
function fromRevertedError(e: ContractFunctionRevertedError): DecodedRevert | undefined {
  if (e.data?.errorName) return fromDecoded(e.data);
  return e.signature ? { reason: e.signature, kind: 'unknown' } : undefined;
}

const isHexData = (value: unknown): value is Hex =>
  typeof value === 'string' && /^0x[0-9a-fA-F]{8,}$/.test(value);

/**
 * Revert data a wallet or node attached to its JSON-RPC error. Providers nest it
 * either as `error.data` or one level further down (`error.data.data`).
 */
function rawRevertData(e: unknown): Hex | undefined {
  const data = (e as { data?: unknown })?.data;
  if (isHexData(data)) return data;
  const nested = (data as { data?: unknown } | undefined)?.data;
  return isHexData(nested) ? nested : undefined;
}

/**
 * The node's "execution reverted: <reason>" (or viem's "Execution reverted with
 * reason: <reason>.") wording, as a last resort. The colon is required: viem's
 * reasonless "Execution reverted for an unknown reason." must not match. The
 * reason has to sit on the same line: a bare "execution reverted: " must not
 * pick up whatever line follows (viem's "Version: viem@…").
 */
const REVERTED_WITH_REASON =
  /execution reverted(?: with reason)?:[ \t]*(?:revert:[ \t]*)?["']?([^"'\n,]+?)["']?\.?[ \t]*(?:,|\n|$)/i;

function reasonFromText(e: unknown): DecodedRevert | undefined {
  const texts: string[] = [];
  if (e instanceof BaseError) texts.push(e.details ?? '', e.shortMessage);
  if (e instanceof Error) texts.push(e.message);
  for (const text of texts) {
    const match = text?.match(REVERTED_WITH_REASON);
    if (match) return errorReason(match[1]);
  }
  return undefined;
}

/** An error and its causes, outermost first (bounded: a cause chain can loop). */
function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  for (let e = error, i = 0; i < 12 && e; i++, e = (e as { cause?: unknown }).cause) chain.push(e);
  return chain;
}

/**
 * The contract revert inside an error, wherever along the cause chain it sits.
 *
 * Sources, best first:
 * 1. an error that already decoded it (`BatchSimulationError.revert`);
 * 2. viem's `ContractFunctionRevertedError`, decoded against the called ABI;
 * 3. raw revert data on a wallet/RPC error (viem's `RawContractError`, a
 *    wallet's `{ code: 3, data }`);
 * 4. the text "execution reverted: <reason>" in a message.
 *
 * Anything else (a rejection, a network failure, a revert without data) gives
 * `undefined`: there is no reason to show.
 */
export function decodeRevert(error: unknown): DecodedRevert | undefined {
  const chain = causeChain(error);

  for (const link of chain) {
    if (typeof link === 'object' && Object.hasOwn(link as object, 'revert')) {
      return (link as WithRevert).revert?.reason ? (link as WithRevert).revert : undefined;
    }
    if (link instanceof ContractFunctionRevertedError) {
      const decoded = fromRevertedError(link);
      if (decoded) return decoded;
    }
  }
  for (const link of chain) {
    const data = rawRevertData(link);
    if (data) {
      const decoded = decodeRevertData(data);
      if (decoded) return decoded;
    }
  }
  for (const link of chain) {
    const decoded = reasonFromText(link);
    if (decoded) return decoded;
  }
  return undefined;
}
