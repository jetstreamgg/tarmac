import { request, gql } from 'graphql-request';
import type { Address, PublicClient } from 'viem';
import { HISTORY_QUERY_LIMIT } from '../constants';
import { usdsSkyRewardAbi } from '../generated';
import { getIndexerUrl } from '../helpers/getIndexerUrl';

/** One RewardPaid event for the wallet, as the indexer records it. */
export type RewardFarmClaim = {
  /** Lowercased farm (reward contract) address. */
  farm: string;
  /** Reward token base units. */
  amount: bigint;
  blockNumber: number;
  blockTimestamp: number;
};

type RewardClaimRow = {
  amount: string;
  blockNumber: string;
  blockTimestamp: string;
  reward: { address: string };
};

const REWARD_CLAIMS_QUERY = gql`
  query RewardFarmClaims($user: String!, $rewardIds: [String!]!, $limit: Int!, $offset: Int!) {
    RewardClaim(
      where: { user: { _eq: $user }, reward_id: { _in: $rewardIds } }
      order_by: [{ blockNumber: asc }, { id: asc }]
      limit: $limit
      offset: $offset
    ) {
      amount
      blockNumber
      blockTimestamp
      reward {
        address
      }
    }
  }
`;

/**
 * Every reward claim the wallet ever made on the given farms, oldest first.
 * The indexer caps each entity query at HISTORY_QUERY_LIMIT rows, so this
 * pages until a short page — a truncated list would under-count the total.
 */
export async function fetchRewardFarmClaims({
  userAddress,
  farmAddresses,
  chainId
}: {
  userAddress: string;
  farmAddresses: string[];
  chainId: number;
}): Promise<RewardFarmClaim[]> {
  const rewardIds = farmAddresses.map(a => `${chainId}-${a.toLowerCase()}`);
  const claims: RewardFarmClaim[] = [];
  for (let offset = 0; ; offset += HISTORY_QUERY_LIMIT) {
    const response = await request<{ RewardClaim: RewardClaimRow[] }>(
      getIndexerUrl(chainId),
      REWARD_CLAIMS_QUERY,
      { user: userAddress.toLowerCase(), rewardIds, limit: HISTORY_QUERY_LIMIT, offset }
    );
    for (const row of response.RewardClaim) {
      claims.push({
        farm: row.reward.address.toLowerCase(),
        amount: BigInt(row.amount),
        blockNumber: Number(row.blockNumber),
        blockTimestamp: Number(row.blockTimestamp)
      });
    }
    if (response.RewardClaim.length < HISTORY_QUERY_LIMIT) return claims;
  }
}

/**
 * The wallet's unclaimed `earned()` balance on each farm, keyed by lowercased
 * farm address, at `blockNumber` (latest when omitted). A farm deployed after
 * that block has no code there, so its call fails: that reads as 0 (nothing
 * could have accrued yet), confirmed with getCode so a real RPC failure on a
 * live farm still throws instead of turning into a false zero.
 */
export async function fetchRewardFarmEarned({
  client,
  userAddress,
  farmAddresses,
  blockNumber
}: {
  client: PublicClient;
  userAddress: Address;
  farmAddresses: Address[];
  blockNumber?: bigint;
}): Promise<Map<string, bigint>> {
  const results = await client.multicall({
    contracts: farmAddresses.map(address => ({
      address,
      abi: usdsSkyRewardAbi,
      functionName: 'earned' as const,
      args: [userAddress] as const
    })),
    allowFailure: true,
    blockNumber
  });

  const earned = new Map<string, bigint>();
  for (const [i, result] of results.entries()) {
    const farm = farmAddresses[i];
    if (result.status === 'success') {
      earned.set(farm.toLowerCase(), result.result);
      continue;
    }
    const code = await client.getCode({ address: farm, blockNumber });
    if (code && code !== '0x') throw result.error;
    earned.set(farm.toLowerCase(), 0n);
  }
  return earned;
}
