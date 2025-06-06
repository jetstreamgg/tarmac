import { Intent } from '@/lib/enums';
import { ChatIntent } from '../types/Chat';
import { IntentMapping } from '@/lib/constants';

// TODO: The structure is yet tbd. Using this structure and values as a placeholder for now.
const disclaimer =
  "Please be aware that while we strive to provide accurate and helpful suggestions, you're solely responsible for reviewing and implementing any recommended actions. We do not guarantee the accuracy or completeness of the AI's suggestions and disclaim any liability for consequences arising from your use of this feature.";

export const CONFIRMATION_WARNING_METADATA: Record<string, { description: string; disclaimer: string }> = {
  [IntentMapping[Intent.TRADE_INTENT]]: {
    description: 'You are about to execute a trade suggested by our AI chatbot.',
    disclaimer
  },
  [IntentMapping[Intent.UPGRADE_INTENT]]: {
    description: "You are about to upgrade your tokens based on our AI chatbot's suggestion.",
    disclaimer
  },
  [IntentMapping[Intent.SAVINGS_INTENT]]: {
    description: "You are about to deposit into savings based on our AI chatbot's suggestion.",
    disclaimer
  },
  [IntentMapping[Intent.REWARDS_INTENT]]: {
    description: "You are about to access rewards based on our AI chatbot's suggestion.",
    disclaimer
  }
};

export const getConfirmationWarningMetadata = (intent?: ChatIntent) => {
  if (!intent?.intent_id) return undefined;

  return (
    CONFIRMATION_WARNING_METADATA[intent.intent_id] || {
      description: 'You are about to execute a transaction suggested by our AI chatbot.',
      disclaimer:
        "Please be aware that while we strive to provide accurate and helpful suggestions, you're solely responsible for reviewing and implementing any recommended actions. We do not guarantee the accuracy or completeness of the AI's suggestions and disclaim any liability for consequences arising from your use of this feature."
    }
  );
};
