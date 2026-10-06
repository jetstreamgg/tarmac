import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
import type { BridgeProgress } from '../model/pendingTransitions';
import type { SafeConfig } from '../model/recipient';

export type SafeMultisigTx = {
  safe: string;
  nonce: number;
  isExecuted: boolean;
  isSuccessful: boolean | null;
  transactionHash: string | null;
};

/** Where a queued Safe transaction stands; null while it still waits for signatures. */
export function safeTxProgress(tx: SafeMultisigTx, safeNonce: number | undefined): BridgeProgress | null {
  if (tx.isExecuted) {
    if (tx.isSuccessful === false) return { kind: 'failed', reason: 'safe-tx-reverted' };
    return tx.transactionHash ? { kind: 'source-executed', txHash: tx.transactionHash } : null;
  }
  // Another transaction executed at this nonce, so this one can never run.
  if (safeNonce !== undefined && safeNonce > tx.nonce) return { kind: 'failed', reason: 'safe-tx-replaced' };
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
  if (typeof tx.safe !== 'string' || nonce === undefined || typeof tx.isExecuted !== 'boolean') return null;
  return {
    safe: tx.safe,
    nonce,
    isExecuted: tx.isExecuted,
    isSuccessful: typeof tx.isSuccessful === 'boolean' ? tx.isSuccessful : null,
    transactionHash: typeof tx.transactionHash === 'string' ? tx.transactionHash : null
  };
}

const getJson = async (url: string): Promise<{ status: number; body: unknown }> => {
  const res = await fetch(url);
  return { status: res.status, body: res.ok ? await res.json() : undefined };
};

// The service indexes a proposed transaction within seconds; one still missing after this was deleted.
const NOT_FOUND_AFTER_MS = 60 * 60_000;

/**
 * Resolves a queued Safe transaction through the Safe Transaction Service, with
 * no time limit: multisig signers can take days.
 */
export async function readSafeTxProgress({
  chainId,
  safeTxHash,
  queuedAt,
  now
}: {
  chainId: number;
  safeTxHash: string;
  queuedAt: number;
  now: number;
}): Promise<BridgeProgress | null> {
  const base = SAFE_TRANSACTION_SERVICE_URL[chainId];
  if (!base) return null;
  const readTx = async () => {
    const { status, body } = await getJson(`${base}/api/v1/multisig-transactions/${safeTxHash}/`);
    return { status, tx: parseSafeTx(body) };
  };
  const { status, tx } = await readTx();
  if (!tx) {
    return status === 404 && now - queuedAt > NOT_FOUND_AFTER_MS
      ? { kind: 'failed', reason: 'safe-tx-not-found' }
      : null;
  }
  if (tx.isExecuted) return safeTxProgress(tx, undefined);
  const safeResponse = await getJson(`${base}/api/v1/safes/${tx.safe}/`);
  const safeNonce = toNonce((safeResponse.body as { nonce?: unknown } | undefined)?.nonce);
  const progress = safeTxProgress(tx, safeNonce);
  if (progress?.kind !== 'failed') return progress;
  // The nonce moved after the first read: this transaction may be what moved it.
  const again = await readTx();
  return again.tx?.isExecuted ? safeTxProgress(again.tx, undefined) : progress;
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
