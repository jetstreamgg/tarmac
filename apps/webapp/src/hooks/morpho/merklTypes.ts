/**
 * Raw shapes of the Merkl rewards API (`/users/{address}/rewards`), shared by
 * the claim-oriented hooks and the earned-history client.
 */

/** Token data from the Merkl API response. */
export type MerklTokenData = {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  /** Current USD price of the reward token. */
  price: number;
};

/** Breakdown data for a reward (explains where the reward comes from). */
export type MerklRewardBreakdown = {
  root: string;
  distributionChainId: number;
  /** Carries the source: a vault address or an airdrop name. */
  reason: string;
  amount: string;
  claimed: string;
  pending: string;
  campaignId: string;
  subCampaignId: string;
};

/**
 * Individual reward data from the Merkl API. Lifetime cumulative per token:
 * amount = claimed + unclaimed, pending = not yet in the merkle root.
 */
export type MerklRewardData = {
  root: string;
  distributionChainId: number;
  recipient: string;
  amount: string;
  claimed: string;
  pending: string;
  proofs: string[];
  token: MerklTokenData;
  breakdowns: MerklRewardBreakdown[];
};

/** Chain data from the Merkl API response. */
export type MerklChainData = {
  endOfDisputePeriod: number;
  id: number;
  name: string;
  icon: string;
  liveCampaigns: number;
};

/** API response structure for the Merkl rewards endpoint. */
export type MerklRewardsApiResponse = {
  chain: MerklChainData;
  rewards: MerklRewardData[];
}[];
