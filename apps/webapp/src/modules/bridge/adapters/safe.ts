import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
import type { BridgeProgress } from '../model/pendingTransitions';
import type { SafeConfig } from '../model/recipient';

export type SafeMultisigTx = {
  safe: string;
  safeTxHash: string;
  nonce: number;
  isExecuted: boolean;
  isSuccessful: boolean | null;
  transactionHash: string | null;
  executedAt?: number;
};

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
  if (!base) return null;
  const tx = parseSafeTx((await getJson(`${base}/api/v1/multisig-transactions/${safeTxHash}/`)).body);
  if (!tx) return null;
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

/**
 * The Safe at `address` on `chainId`: its config, or null when the service
 * says there is none. Throws when it can't tell (no service for the chain,
 * network error), which the recipient policy treats as unverified.
 */
export async function readSafeConfig({
  chainId,
  address
}: {
  chainId: number;
  address: string;
}): Promise<SafeConfig | null> {
  const base = SAFE_TRANSACTION_SERVICE_URL[chainId];
  if (!base) throw new Error(`No Safe Transaction Service for chain ${chainId}`);
  const { status, body } = await getJson(`${base}/api/v1/safes/${address}/`);
  if (status === 404) return null;
  const safe = body as { owners?: unknown; threshold?: unknown } | undefined;
  if (
    !safe ||
    !Array.isArray(safe.owners) ||
    !safe.owners.every(owner => typeof owner === 'string') ||
    typeof safe.threshold !== 'number'
  ) {
    throw new Error(`Unreadable Safe response (${status})`);
  }
  return { owners: safe.owners as string[], threshold: safe.threshold };
}
