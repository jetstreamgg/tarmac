import { MERKL_API_URL } from './constants';

export type MerklRewardTokenRaw = {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  /** Current USD price of the reward token. */
  price: number;
};

/** One campaign's slice of a reward; `reason` carries the source (vault address or airdrop name). */
export type MerklRewardBreakdownRaw = {
  reason: string;
  amount: string;
  claimed: string;
  pending: string;
  campaignId: string;
};

/** Lifetime cumulative reward for one token: amount = claimed + unclaimed, pending = not yet in the merkle root. */
export type MerklUserRewardRaw = {
  root: string;
  recipient: string;
  amount: string;
  claimed: string;
  pending: string;
  token: MerklRewardTokenRaw;
  breakdowns: MerklRewardBreakdownRaw[];
};

export type MerklUserRewardsApiResponse = {
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

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Merkl API error: ${response.status}`);
  }
  return (await response.json()) as T;
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
