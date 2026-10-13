import { formatBigInt } from '@/utils';
import type { ClaimableReward } from '@/modules/claim/types';
import { makeStakeId } from '@/modules/claim/adapters/stakeAdapter';
import { rewardTokenName } from '@/modules/claim/tokenNames';
import { wadToFloat, wadToUsd } from './stakeUsdNotional';

/** One urn's claimable balance on one reward contract. */
export type StakeUrnClaim = {
  urnIndex: bigint;
  contractAddress: `0x${string}`;
  claimBalance: bigint;
  rewardSymbol: string;
};

/** The same token's claims summed across urns (Rewards section row, claim-modal hero). */
export type StakeTokenClaim = {
  rewardSymbol: string;
  claimBalance: bigint;
  claims: StakeUrnClaim[];
};

const isSky = (symbol: string) => symbol.toUpperCase() === 'SKY';

/** Groups per-urn claims by reward token, SKY first (legacy sort), otherwise first-seen order. */
export function groupClaimsByToken(claims: readonly StakeUrnClaim[]): StakeTokenClaim[] {
  const groups = new Map<string, StakeTokenClaim>();
  for (const claim of claims) {
    const group = groups.get(claim.rewardSymbol);
    if (group) {
      group.claimBalance += claim.claimBalance;
      group.claims.push(claim);
    } else {
      groups.set(claim.rewardSymbol, {
        rewardSymbol: claim.rewardSymbol,
        claimBalance: claim.claimBalance,
        claims: [claim]
      });
    }
  }
  return [...groups.values()].sort((a, b) => Number(isSky(b.rewardSymbol)) - Number(isSky(a.rewardSymbol)));
}

function toReward(
  id: string,
  rewardSymbol: string,
  claimBalance: bigint,
  priceOf: (symbol: string) => number,
  chainId: number
): ClaimableReward {
  return {
    id,
    source: 'stake',
    tokenSymbol: rewardSymbol,
    tokenName: rewardTokenName(rewardSymbol),
    icon: null,
    formattedAmount: formatBigInt(claimBalance, { unit: 18, minDecimals: 2, maxDecimals: 2 }),
    amount: wadToFloat(claimBalance),
    amountUsd: wadToUsd(claimBalance, priceOf(rewardSymbol)),
    chainId
  };
}

/** Per-urn claim → the adapter's `ClaimableReward` (id `${urnIndex}:${contract}`), what the claim calls consume. */
export function urnClaimToReward(
  claim: StakeUrnClaim,
  priceOf: (symbol: string) => number,
  chainId: number
): ClaimableReward {
  return toReward(
    makeStakeId(claim.urnIndex, claim.contractAddress),
    claim.rewardSymbol,
    claim.claimBalance,
    priceOf,
    chainId
  );
}

/** Token group → a display row keyed by symbol. */
export function tokenClaimToReward(
  group: StakeTokenClaim,
  priceOf: (symbol: string) => number,
  chainId: number
): ClaimableReward {
  return toReward(group.rewardSymbol, group.rewardSymbol, group.claimBalance, priceOf, chainId);
}
