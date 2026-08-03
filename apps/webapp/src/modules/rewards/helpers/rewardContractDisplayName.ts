import { TOKENS, type RewardContract } from '@/hooks';

/**
 * Product title for a reward contract on the redesigned surfaces (detail-page
 * header, modal titles). The registry names marketplace rows "Earn <TOKEN>"
 * (APP-399 #5); detail surfaces keep the "<TOKEN> Rewards" framing for token
 * farms. Chronicle's registry name already reads as a title, so it passes
 * through.
 */
export function rewardContractDisplayName(contract: RewardContract): string {
  return contract.rewardToken.symbol === TOKENS.cle.symbol
    ? contract.name
    : `${contract.rewardToken.symbol} Rewards`;
}
