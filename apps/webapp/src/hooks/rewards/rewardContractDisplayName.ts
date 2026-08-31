import { TOKENS } from '../tokens/tokens.constants';
import type { RewardContract } from './rewards';

/**
 * Display title for a reward farm on the redesigned surfaces (marketplace rows,
 * detail-page header, modal titles): "<TOKEN> Rewards", or "Chronicle Points
 * Rewards" for the points farm (APP-526). The registry `contract.name` keeps
 * its legacy "Earn <TOKEN>" form because analytics reports it as `product`.
 */
export function rewardContractDisplayName(contract: RewardContract): string {
  const symbol = contract.rewardToken.symbol;
  return symbol === TOKENS.cle.symbol ? 'Chronicle Points Rewards' : `${symbol} Rewards`;
}
