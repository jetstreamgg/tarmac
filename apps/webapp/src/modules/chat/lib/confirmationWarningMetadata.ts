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

export const CONFIRMATION_WARNING_METADATA: Record<
  string,
  { description: string; disclaimer: string; associatedRisks: string[] }
> = {
  [IntentMapping[Intent.TRADE_INTENT]]: {
    description: 'Navigate to Trade with transaction details prefilled by our AI chatbot.',
    disclaimer: tradeSpeedBump.howItWorks,
    associatedRisks: tradeSpeedBump.associatedRisks
  },
  [IntentMapping[Intent.UPGRADE_INTENT]]: {
    description: 'Navigate to Upgrade with token amounts prefilled by our AI chatbot.',
    disclaimer: upgradeSpeedBump.howItWorks,
    associatedRisks: upgradeSpeedBump.associatedRisks
  },
  [IntentMapping[Intent.SAVINGS_INTENT]]: {
    description: 'Navigate to Savings with deposit amount prefilled by our AI chatbot.',
    disclaimer: skySavingsRateSpeedBump.howItWorks,
    associatedRisks: skySavingsRateSpeedBump.associatedRisks
  },
  [IntentMapping[Intent.REWARDS_INTENT]]: {
    description: 'Navigate to Rewards as suggested by our AI chatbot.',
    disclaimer: skyTokenRewardsSpeedBump.howItWorks,
    associatedRisks: skyTokenRewardsSpeedBump.associatedRisks
  },
  [IntentMapping[Intent.STAKE_INTENT]]: {
    description: 'Navigate to Stake with staking details prefilled by our AI chatbot.',
    disclaimer: stakingEngineSpeedBump.howItWorks,
    associatedRisks: stakingEngineSpeedBump.associatedRisks
  },
  [IntentMapping[Intent.EXPERT_INTENT]]: {
    description: 'Navigate to Expert modules with settings prefilled by our AI chatbot.',
    disclaimer: expertModulesSpeedBump.howItWorks,
    associatedRisks: expertModulesSpeedBump.associatedRisks
  }
};

export const getConfirmationWarningMetadata = (intent?: ChatIntent) => {
  const defaultMetadata = {
    description: 'Navigate to the suggested action with details prefilled by our AI chatbot.',
    disclaimer:
      "Please be aware that while we strive to provide accurate and helpful suggestions, you're solely responsible for reviewing and implementing any recommended actions. We do not guarantee the accuracy or completeness of the AI's suggestions and disclaim any liability for consequences arising from your use of this feature.",
    associatedRisks: []
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
