import { queryOptions } from '@tanstack/react-query';
import { SAFE_TRANSACTION_SERVICE_URL } from '../shared/constants';

export type SafeConfig = { owners: string[]; threshold: number };

/** The service's answer for an address: null when it is no Safe; `config` is undefined when a Safe's body can't be read. */
export type SafeAccount = { config: SafeConfig | undefined } | null;

const parseSafeConfig = (body: unknown): SafeConfig | undefined => {
  const safe = body as { owners?: unknown; threshold?: unknown } | undefined;
  return safe &&
    Array.isArray(safe.owners) &&
    safe.owners.every(owner => typeof owner === 'string') &&
    typeof safe.threshold === 'number'
    ? { owners: safe.owners as string[], threshold: safe.threshold }
    : undefined;
};

/**
 * The Safe at `address` on `chainId`: 200 is a Safe and 404 is none. Throws
 * when it can't tell (no service for the chain, any other reply, network error).
 */
export async function readSafeAccount({
  chainId,
  address
}: {
  chainId: number;
  address: string;
}): Promise<SafeAccount> {
  const base = SAFE_TRANSACTION_SERVICE_URL[chainId];
  if (!base) throw new Error(`No Safe Transaction Service for chain ${chainId}`);
  const res = await fetch(`${base}/api/v1/safes/${address}/`);
  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error(`Safe Transaction Service replied ${res.status}`);
  return { config: parseSafeConfig(await res.json().catch(() => undefined)) };
}

/**
 * One cache entry per Safe and chain, shared by the wallet status and the
 * bridge form so the rate-limited service is asked once. Callers set
 * `enabled` and their own `staleTime`.
 */
export const safeAccountQuery = ({
  address,
  chainId
}: {
  address: string | undefined;
  chainId: number | undefined;
}) =>
  queryOptions({
    queryKey: ['safe-account', address?.toLowerCase(), chainId],
    queryFn: () => readSafeAccount({ chainId: chainId!, address: address! }),
    // An outage reads as unknown, which blocks callers that fail closed: say so quickly.
    retry: 1
  });
