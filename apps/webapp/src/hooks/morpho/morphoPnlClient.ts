import { MORPHO_API_URL, USER_VAULT_V2_PNL_QUERY, VAULT_V2_TRANSACTIONS_SINCE_QUERY } from './constants';
import type {
  MorphoUserVaultV2PnlApiResponse,
  MorphoUserVaultV2Position,
  MorphoVaultV2Transaction,
  MorphoVaultV2TransactionsApiResponse
} from './morpho';

async function postGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const json = (await response.json()) as T & { errors?: { message?: string }[] };
  if (json.errors?.length) {
    throw new Error(`Morpho GraphQL error: ${json.errors[0]?.message ?? 'unknown'}`);
  }
  return json;
}

/**
 * All V2 vault positions of a user with PnL and a daily in-window balance
 * series. Returns every vault the user has touched (exited ones included);
 * callers filter to the vaults they care about. Unknown wallet → [].
 */
export async function fetchUserVaultV2Pnl({
  userAddress,
  chainId,
  startTimestamp,
  endTimestamp
}: {
  userAddress: string;
  chainId: number;
  startTimestamp: number;
  endTimestamp: number;
}): Promise<MorphoUserVaultV2Position[]> {
  const json = await postGraphql<MorphoUserVaultV2PnlApiResponse>(USER_VAULT_V2_PNL_QUERY, {
    userAddress,
    chainId,
    startTimestamp,
    endTimestamp
  });
  return json.data.userByAddress?.vaultV2Positions ?? [];
}

/**
 * Deposits and withdrawals for the given vaults from `sinceTimestamp` onward,
 * newest-first — the flow legs of the monthly earnings computation.
 */
export async function fetchVaultV2TransactionsSince({
  userAddress,
  chainId,
  vaultAddresses,
  sinceTimestamp
}: {
  userAddress: string;
  chainId: number;
  vaultAddresses: string[];
  sinceTimestamp: number;
}): Promise<MorphoVaultV2Transaction[]> {
  const json = await postGraphql<MorphoVaultV2TransactionsApiResponse>(VAULT_V2_TRANSACTIONS_SINCE_QUERY, {
    userAddress,
    chainId,
    vaultAddresses,
    sinceTimestamp
  });
  return json.data.vaultV2transactions.items;
}
