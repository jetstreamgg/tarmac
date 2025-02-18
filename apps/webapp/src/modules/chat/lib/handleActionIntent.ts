import {
  TRADE,
  REWARDS,
  UPGRADE,
  SAVINGS,
  TRADE_MAINNET,
  TRADE_ARBITRUM,
  TRADE_BASE,
  SAVINGS_MAINNET,
  SAVINGS_ARBITRUM,
  SAVINGS_BASE
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

  // TODO: We don't know yet where we're going to get the tab from (slots or intent), so we're just going to presume it comes from the slots
  const tab = slots.find(slot => slot.field === 'tab')?.parsed_value as 'left' | 'right' | undefined;

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
    case SAVINGS_MAINNET:
    case SAVINGS_BASE:
    case SAVINGS_ARBITRUM:
      return generateSavingsIntents(slots, chains, tab, detectedNetwork);
    // TODO: add Seal
    default:
      return [];
  }
};
