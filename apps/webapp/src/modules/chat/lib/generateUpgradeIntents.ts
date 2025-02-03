import { ChatIntent, Slot } from '../types/Chat';
import { IntentMapping, QueryParams } from '@/lib/constants';

export const generateUpgradeIntents = (slots: Slot[]): ChatIntent[] => {
  const { UPGRADE_INTENT: UPGRADE } = IntentMapping;
  const intent_id = UPGRADE;
  const { Widget, InputAmount, Chat, SourceToken } = QueryParams;

  const amountSlot = slots.find(slot => slot.field === 'amount');
  const sourceTokenSlot = slots.find(slot => slot.field === 'source_token');
  const targetTokenSlot = slots.find(slot => slot.field === 'target_token');

  const intents = [];

  if (sourceTokenSlot?.parsed_value === 'MKR' || targetTokenSlot?.parsed_value === 'SKY') {
    if (amountSlot?.parsed_value && !Number.isNaN(Number(amountSlot.parsed_value))) {
      intents.push({
        intent_id,
        intent_description: `Upgrade ${amountSlot.parsed_value} MKR to SKY`,
        url: `?${Widget}=${UPGRADE}&${InputAmount}=${amountSlot.parsed_value}&${SourceToken}=MKR&${Chat}=true`
      });
    }
    intents.push({
      intent_id,
      intent_description: 'Upgrade MKR to SKY',
      url: `?${Widget}=${UPGRADE}&${SourceToken}=MKR&${Chat}=true`
    });
  }

  if (sourceTokenSlot?.parsed_value === 'DAI' || targetTokenSlot?.parsed_value === 'USDS') {
    if (amountSlot?.parsed_value && !Number.isNaN(Number(amountSlot.parsed_value))) {
      intents.push({
        intent_id,
        intent_description: `Upgrade ${amountSlot.parsed_value} DAI to USDS`,
        url: `?${Widget}=${UPGRADE}&${InputAmount}=${amountSlot.parsed_value}&${SourceToken}=DAI&${Chat}=true`
      });
    }
    intents.push({
      intent_id,
      intent_description: 'Upgrade DAI to USDS',
      url: `?${Widget}=${UPGRADE}&${SourceToken}=DAI&${Chat}=true`
    });
  }

  intents.push({
    intent_id,
    intent_description: 'Go to Upgrade',
    url: `?${Widget}=${UPGRADE}&${Chat}=true`
  });

  return intents;
};
