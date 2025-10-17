import { Intent } from '@/lib/enums';
import { ChatIntent } from '../types/Chat';
import { IntentMapping, mapQueryParamToIntent } from '@/lib/constants';
import {
  skySavingsRateSpeedBump,
  skyTokenRewardsSpeedBump,
  tradeSpeedBump,
  upgradeSpeedBump,
  stakingEngineSpeedBump,
  expertModulesSpeedBump
} from '@/data/chat/speed-bumps';

export const CONFIRMATION_WARNING_METADATA: Record<string, { description: string; disclaimer: string }> = {
  [IntentMapping[Intent.TRADE_INTENT]]: {
    description: 'You are about to navigate to Trade with transaction details prefilled by our AI chatbot',
    disclaimer: tradeSpeedBump.content
  },
  [IntentMapping[Intent.UPGRADE_INTENT]]: {
    description: 'You are about to navigate to Upgrade with token amounts prefilled by our AI chatbot',
    disclaimer: upgradeSpeedBump.content
  },
  [IntentMapping[Intent.SAVINGS_INTENT]]: {
    description: 'You are about to navigate to Savings with deposit amount prefilled by our AI chatbot',
    disclaimer: skySavingsRateSpeedBump.content
  },
  [IntentMapping[Intent.REWARDS_INTENT]]: {
    description: 'You are about to navigate to Rewards as suggested by our AI chatbot',
    disclaimer: skyTokenRewardsSpeedBump.content
  },
  [IntentMapping[Intent.STAKE_INTENT]]: {
    description: 'You are about to navigate to Stake with staking details prefilled by our AI chatbot',
    disclaimer: stakingEngineSpeedBump.content
  },
  [IntentMapping[Intent.EXPERT_INTENT]]: {
    description: 'You are about to navigate to Expert modules with settings prefilled by our AI chatbot',
    disclaimer: expertModulesSpeedBump.content
  }
};

export const getConfirmationWarningMetadata = (intent?: ChatIntent) => {
  const defaultMetadata = {
    description: 'You are about to navigate to the suggested action with details prefilled by our AI chatbot',
    disclaimer:
      "Please be aware that while we strive to provide accurate and helpful suggestions, you're solely responsible for reviewing and implementing any recommended actions. We do not guarantee the accuracy or completeness of the AI's suggestions and disclaim any liability for consequences arising from your use of this feature."
  };

  if (!intent?.url) return defaultMetadata;

  // Extract widget parameter from URL
  const urlParts = intent.url.split('?');
  if (urlParts.length < 2) return defaultMetadata;

  const params = new URLSearchParams(urlParts[1]);
  const widgetParam = params.get('widget');

  if (!widgetParam) return defaultMetadata;

  // Convert widget param to Intent enum and then to string key
  const intentEnum = mapQueryParamToIntent(widgetParam);
  const intentKey = IntentMapping[intentEnum];

  return CONFIRMATION_WARNING_METADATA[intentKey] || defaultMetadata;
};
