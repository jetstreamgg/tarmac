import { TOKENS, type RewardContract } from '@/hooks';

/**
 * Product title for a reward contract on the redesigned surfaces (detail-page
 * header, modal titles). The registry keeps the legacy names as-is ("With: USDS
 * Get: SPK") per the marketplace-labels decision; those don't read as product
 * titles, so token farms render as "<TOKEN> Rewards" here. Chronicle's registry
 * name ("Chronicle Points") already is one.
 */
export function rewardContractDisplayName(contract: RewardContract): string {
  return contract.rewardToken.symbol === TOKENS.cle.symbol
    ? contract.name
    : `${contract.rewardToken.symbol} Rewards`;
}
