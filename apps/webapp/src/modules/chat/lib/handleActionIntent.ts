import {
  TRADE,
  REWARDS,
  UPGRADE,
  SAVINGS,
  TRADE_MAINNET,
  TRADE_ARBITRUM,
  TRADE_BASE
} from './intentClassificationOptions';
import { ChatIntent, Slot } from '../types/Chat';
import { generateRewardIntents } from './generateRewardIntents';
import { generateSavingsIntents } from './generateSavingsIntents';
import { generateTradeIntents } from './generateTradeIntents';
import { generateUpgradeIntents } from './generateUpgradeIntents';
import { RewardContract } from '@jetstreamgg/hooks';
import { Chain } from 'wagmi/chains';

export const handleActionIntent = ({
  classification,
  slots,
  chains,
  rewards
}: {
  classification: string;
  slots: Slot[];
  chains: Chain[];
  rewards?: RewardContract[];
}): ChatIntent[] => {
  const parts = classification.split('_');
  const detectedNetwork = parts.length > 1 ? parts[1] : undefined;

  switch (classification) {
    case TRADE:
    case TRADE_MAINNET:
    case TRADE_BASE:
    case TRADE_ARBITRUM:
      return generateTradeIntents(slots, chains, detectedNetwork);
    case REWARDS:
      return generateRewardIntents(slots, rewards);
    case UPGRADE:
      return generateUpgradeIntents(slots);
    case SAVINGS:
      return generateSavingsIntents(slots);
    // TODO: add Seal
    default:
      return [];
  }
};
