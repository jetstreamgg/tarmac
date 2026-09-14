import { MERKL_API_URL } from './constants';
import { fetchJson } from '../shared/fetchJson';
import type { MerklRewardBreakdown, MerklRewardData } from './merklTypes';

/** The slice of a breakdown the earned computation reads. */
export type MerklRewardBreakdownRaw = Pick<
  MerklRewardBreakdown,
  'reason' | 'amount' | 'claimed' | 'pending' | 'campaignId'
>;

/** The slice of a reward the earned computation reads (no proofs — it never claims). */
export type MerklUserRewardRaw = Pick<
  MerklRewardData,
  'root' | 'recipient' | 'amount' | 'claimed' | 'pending' | 'token'
> & {
  breakdowns: MerklRewardBreakdownRaw[];
};

type MerklUserRewardsApiResponse = {
  chain: { id: number };
  rewards: MerklUserRewardRaw[];
}[];

/** One on-chain claim event (a delta, not a cumulative total). `token` is the token address. */
export type MerklClaimRaw = {
  id: string;
  chainId: number;
  timestamp: number;
  token: string;
  reason: string;
  amount: string;
};

function getJson<T>(url: string): Promise<T> {
  return fetchJson<T>(url, { label: 'Merkl API', requireOk: true });
}

/**
 * Lifetime rewards for a wallet on one chain, with per-campaign breakdowns.
 * Deliberately NOT the claim-oriented fetch (`claimableOnly=true` drops fully
 * claimed rewards, which is wrong for "earned"). Unknown wallet → [].
 */
export async function fetchMerklUserRewards({
  userAddress,
  chainId
}: {
  userAddress: string;
  chainId: number;
}): Promise<MerklUserRewardRaw[]> {
  const result = await getJson<MerklUserRewardsApiResponse>(
    `${MERKL_API_URL}/users/${userAddress}/rewards?chainId=${chainId}`
  );
  return result.find(r => r.chain.id === chainId)?.rewards ?? [];
}

/**
 * All claim events of a wallet on one chain, needed to value earnings at the
 * price on each claim day. The param is `recipient` — `user`/`userAddress` 400.
 */
export async function fetchMerklClaims({
  userAddress,
  chainId
}: {
  userAddress: string;
  chainId: number;
}): Promise<MerklClaimRaw[]> {
  return getJson<MerklClaimRaw[]>(`${MERKL_API_URL}/claims?recipient=${userAddress}&chainId=${chainId}`);
}
