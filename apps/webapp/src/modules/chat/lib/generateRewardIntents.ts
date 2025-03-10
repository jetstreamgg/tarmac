import { ChatIntent, Slot, SlotType } from '../types/Chat';
import { IntentMapping, QueryParams } from '@/lib/constants';
import { RewardContract } from '@jetstreamgg/hooks';

export const generateRewardIntents = (slots: Slot[], rewards?: RewardContract[]): ChatIntent[] => {
  const { REWARDS_INTENT: REWARDS } = IntentMapping;
  const intent_id = REWARDS;
  const { Widget, InputAmount, Chat } = QueryParams;
  const { Amount, SourceToken, TargetToken } = SlotType;

  const amountSlot = slots.find(slot => slot.field === Amount);
  const sourceTokenSlot = slots.find(slot => slot.field === SourceToken);
  const targetTokenSlot = slots.find(slot => slot.field === TargetToken);

  let stakeReward;
  const intents = [];

  if (!rewards) return [];

  // check if source token is in the reward options as a stake token
  if (sourceTokenSlot?.parsed_value) {
    stakeReward = rewards.find(
      r => r.supplyToken.symbol.toUpperCase() === sourceTokenSlot?.parsed_value?.toUpperCase()
    );
  }

  if (stakeReward) {
    if (amountSlot && !Number.isNaN(Number(amountSlot.parsed_value))) {
      intents.push({
        intent_id,
        intent_description: `Access rewards with ${amountSlot.parsed_value} ${stakeReward.supplyToken.symbol}`,
        url: `?${Widget}=${REWARDS}&${InputAmount}=${amountSlot.parsed_value}${stakeReward.contractAddress ? `&reward=${stakeReward.contractAddress}` : ''}&${Chat}=true`
      });
    } else {
      intents.push({
        intent_id,
        intent_description: `Access rewards with ${stakeReward.supplyToken.symbol}`,
        url: `?${Widget}=${REWARDS}${stakeReward.contractAddress ? `&reward=${stakeReward.contractAddress}` : ''}&${Chat}=true`
      });
    }
  }

  let targetReward;
  // check if target token is in the reward options as a reward token
  if (targetTokenSlot?.parsed_value) {
    targetReward = rewards.find(
      f => f.rewardToken.symbol.toUpperCase() === targetTokenSlot?.parsed_value?.toUpperCase()
    );
  }

  if (targetReward) {
    intents.push({
      intent_id,
      intent_description: `Get ${targetReward.rewardToken.symbol} rewards with ${targetReward.supplyToken.symbol}`,
      url: `?${Widget}=${REWARDS}${targetReward.contractAddress ? `&reward=${targetReward.contractAddress}` : ''}&${Chat}=true`
    });
  }

  intents.push({
    intent_id,
    intent_description: 'Go to Rewards',
    url: `?${Widget}=${REWARDS}&${Chat}=true`
  });

  return intents;
};
