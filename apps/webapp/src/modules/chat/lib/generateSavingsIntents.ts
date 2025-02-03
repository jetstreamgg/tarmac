import { ChatIntent, Slot } from '../types/Chat';
import { IntentMapping, QueryParams } from '@/lib/constants';

export const generateSavingsIntents = (slots: Slot[]): ChatIntent[] => {
  const { SAVINGS_INTENT: SAVINGS } = IntentMapping;
  const intent_id = SAVINGS;
  const { Widget, InputAmount, Chat } = QueryParams;

  const amountSlot = slots.find(slot => slot.field === 'amount');

  const intents = [];

  if (amountSlot && !Number.isNaN(Number(amountSlot.parsed_value))) {
    intents.push({
      intent_id,
      intent_description: `Deposit ${amountSlot.parsed_value} USDS into Savings`,
      url: `?${Widget}=${SAVINGS}&${InputAmount}=${amountSlot.parsed_value}&${Chat}=true`
    });
  }
  intents.push({
    intent_id,
    intent_description: 'Go to Savings',
    url: `?${Widget}=${SAVINGS}&${Chat}=true`
  });

  return intents;
};
