import { isAddressEqual, toEventSelector, type Log } from 'viem';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
import type { BridgeProgress } from '../model/pendingTransitions';
import type { PendingBridgeAction } from '../model/types';

export type SafeMultisigTx = {
  safe: string;
  safeTxHash: string;
  nonce: number;
  isExecuted: boolean;
  isSuccessful: boolean | null;
  transactionHash: string | null;
  executedAt?: number;
};

// Safe 1.3 and 1.4 share the selector; 1.4 indexes the Safe tx hash.
const EXECUTION_FAILURE = toEventSelector('event ExecutionFailure(bytes32 txHash, uint256 payment)');

/** The Safe's execTransaction mined but its inner call failed, so the transaction moved nothing. */
export const safeExecutionFailed = (logs: Pick<Log, 'address' | 'topics'>[], safe: string): boolean =>
  logs.some(
    log => log.topics[0] === EXECUTION_FAILURE && isAddressEqual(log.address, safe as Log['address'])
  );

const sameHash = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Where a queued Safe transaction stands, given the executed transactions the
 * service lists at its nonce; null while it still waits for signatures.
 */
export function safeTxProgress(
  tx: SafeMultisigTx,
  executedAtNonce: SafeMultisigTx[] = []
): BridgeProgress | null {
  const executed = tx.isExecuted
    ? tx
    : executedAtNonce.find(other => other.isExecuted && sameHash(other.safeTxHash, tx.safeTxHash));
  if (executed) {
    if (executed.isSuccessful === false) return { kind: 'failed', reason: 'safe-tx-reverted' };
    return executed.transactionHash
      ? {
          kind: 'source-executed',
          txHash: executed.transactionHash,
          ...(executed.executedAt !== undefined && { executedAt: executed.executedAt })
        }
      : null;
  }
  // Only another executed transaction at this nonce rules this one out: the Safe nonce can move first.
  if (executedAtNonce.some(other => other.isExecuted)) return { kind: 'failed', reason: 'safe-tx-replaced' };
  return null;
}

const toNonce = (value: unknown): number | undefined => {
  const nonce = Number(value);
  return typeof value !== 'boolean' && value !== null && value !== '' && Number.isInteger(nonce)
    ? nonce
    : undefined;
};

export function parseSafeTx(value: unknown): SafeMultisigTx | null {
  if (typeof value !== 'object' || value === null) return null;
  const tx = value as Record<string, unknown>;
  const nonce = toNonce(tx.nonce);
  if (
    typeof tx.safe !== 'string' ||
    typeof tx.safeTxHash !== 'string' ||
    nonce === undefined ||
    typeof tx.isExecuted !== 'boolean'
  ) {
    return null;
  }
  const executedAt = typeof tx.executionDate === 'string' ? Date.parse(tx.executionDate) : NaN;
  return {
    safe: tx.safe,
    safeTxHash: tx.safeTxHash,
    nonce,
    isExecuted: tx.isExecuted,
    isSuccessful: typeof tx.isSuccessful === 'boolean' ? tx.isSuccessful : null,
    transactionHash: typeof tx.transactionHash === 'string' ? tx.transactionHash : null,
    ...(Number.isFinite(executedAt) && { executedAt })
  };
}

const getJson = async (url: string): Promise<{ status: number; body: unknown }> => {
  const res = await fetch(url);
  return { status: res.status, body: res.ok ? await res.json() : undefined };
};

/** `missing` when the service answers 404 for the Safe tx hash. */
async function readQueuedSafeTx(
  base: string,
  safeTxHash: string
): Promise<{ missing: boolean; progress: BridgeProgress | null }> {
  const { status, body } = await getJson(`${base}/api/v1/multisig-transactions/${safeTxHash}/`);
  const tx = parseSafeTx(body);
  return { missing: status === 404, progress: tx && (await resolveSafeTx(base, tx)) };
}

/**
 * Resolves a queued Safe transaction through the Safe Transaction Service, with
 * no time limit: multisig signers can take days, and a missing transaction keeps waiting.
 */
export async function readSafeTxProgress({
  chainId,
  safeTxHash
}: {
  chainId: number;
  safeTxHash: string;
}): Promise<BridgeProgress | null> {
  const base = SAFE_TRANSACTION_SERVICE_URL[chainId];
  return base ? (await readQueuedSafeTx(base, safeTxHash)).progress : null;
}

/** A proposal the service still doesn't have this long after it was sent was deleted. */
export const SAFE_ACTION_MISSING_MS = 60 * 60 * 1000;

/**
 * Settles a destination action a Safe sent: confirmed under its on-chain hash
 * once executed, dropped when it reverted, was replaced at its nonce, or was
 * deleted. A deleted proposal leaves no trace, so a 404 counts only after
 * `SAFE_ACTION_MISSING_MS`; any other unknown keeps the action sent.
 */
export async function readSafeActionProgress({
  chainId,
  sent,
  now
}: {
  chainId: number;
  sent: PendingBridgeAction;
  now: number;
}): Promise<BridgeProgress | null> {
  const base = SAFE_TRANSACTION_SERVICE_URL[chainId];
  if (!base) return null;
  const { missing, progress } = await readQueuedSafeTx(base, sent.txHash);
  const dropped = { kind: 'action-dropped', txHash: sent.txHash } as const;
  if (missing) return now - sent.at > SAFE_ACTION_MISSING_MS ? dropped : null;
  if (progress?.kind === 'failed') return dropped;
  if (progress?.kind !== 'source-executed') return null;
  return {
    kind: 'action-confirmed',
    action: sent.action,
    txHash: progress.txHash,
    ...(progress.executedAt !== undefined && { at: progress.executedAt })
  };
}

async function resolveSafeTx(base: string, tx: SafeMultisigTx): Promise<BridgeProgress | null> {
  if (tx.isExecuted) return safeTxProgress(tx);
  const safeNonce = toNonce(
    ((await getJson(`${base}/api/v1/safes/${tx.safe}/`)).body as { nonce?: unknown } | undefined)?.nonce
  );
  if (safeNonce === undefined || safeNonce <= tx.nonce) return null;
  // The nonce moved past ours: ask what executed there, which may be this transaction.
  const { body } = await getJson(
    `${base}/api/v1/safes/${tx.safe}/multisig-transactions/?nonce=${tx.nonce}&executed=true`
  );
  const results = (body as { results?: unknown } | undefined)?.results;
  if (!Array.isArray(results)) return null;
  const executedAtNonce = results
    .map(parseSafeTx)
    .filter((other): other is SafeMultisigTx => other !== null && other.nonce === tx.nonce);
  return safeTxProgress(tx, executedAtNonce);
}
