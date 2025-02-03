import { TRADE, TRADE_MAINNET, TRADE_BASE, TRADE_ARBITRUM } from '../../lib/intentClassificationOptions';

export const generateRandomResponse = () => {
  const responses = [
    'I can help you with that! What would you like to know?',
    "Here's what I found about your request.",
    'Let me assist you with that.',
    'I understand you want to know more about this topic.'
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

export const generateRandomIntent = () => {
  const intents = [
    TRADE,
    TRADE_MAINNET,
    TRADE_BASE,
    TRADE_ARBITRUM,
    // UPGRADE,
    // SAVINGS,
    // REWARDS,
    'NONE'
  ];
  return intents[Math.floor(Math.random() * intents.length)];
};

export const generateRandomRecommendations = () => {
  const questions = [
    { metadata: { content: 'What is Sky Protocol?' } },
    { metadata: { content: 'How do I trade tokens?' } },
    { metadata: { content: 'What are the benefits of upgrading?' } },
    { metadata: { content: 'How do rewards work?' } },
    { metadata: { content: 'Can you explain the savings rate?' } },
    { metadata: { content: 'What tokens are supported?' } }
  ];

  const count = Math.floor(Math.random() * 4) + 1; // 1-4 recommendations
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

type MockSlot = {
  field: string;
  parsed_value: string;
};

export const generateRandomSlots = (intent?: string): MockSlot[] => {
  // If not a trade intent, return the original simple mock
  if (!intent?.startsWith('TRADE')) {
    const tokens = ['DAI', 'USDC', 'USDT', 'ETH', 'USDS'];
    return [
      {
        field: 'token',
        parsed_value: tokens[Math.floor(Math.random() * tokens.length)]
      },
      {
        field: 'amount',
        parsed_value: Math.floor(Math.random() * 1000).toString()
      }
    ];
  }

  // Trade-specific mock data
  const sourceTokens = ['DAI', 'USDC', 'USDT', 'ETH', 'USDS', 'MKR', 'SKY'];
  const targetTokens = ['DAI', 'USDC', 'USDT', 'ETH', 'USDS', 'MKR', 'SKY'];
  const amounts = ['0.1', '1', '10', '100', '1000', undefined];

  // Different combinations of slots for trade intents
  const slotCombinations = [
    // Complete trade info
    () => [
      {
        field: 'source_token',
        parsed_value: sourceTokens[Math.floor(Math.random() * sourceTokens.length)]
      },
      {
        field: 'target_token',
        parsed_value: targetTokens[Math.floor(Math.random() * targetTokens.length)]
      },
      {
        field: 'amount',
        parsed_value: amounts[Math.floor(Math.random() * (amounts.length - 1))]!
      }
    ],
    // Only source token
    () => [
      {
        field: 'source_token',
        parsed_value: sourceTokens[Math.floor(Math.random() * sourceTokens.length)]
      }
    ],
    // Only target token
    () => [
      {
        field: 'target_token',
        parsed_value: targetTokens[Math.floor(Math.random() * targetTokens.length)]
      }
    ],
    // Source and target, no amount
    () => [
      {
        field: 'source_token',
        parsed_value: sourceTokens[Math.floor(Math.random() * sourceTokens.length)]
      },
      {
        field: 'target_token',
        parsed_value: targetTokens[Math.floor(Math.random() * targetTokens.length)]
      }
    ],
    // Source and amount
    () => [
      {
        field: 'source_token',
        parsed_value: sourceTokens[Math.floor(Math.random() * sourceTokens.length)]
      },
      {
        field: 'amount',
        parsed_value: amounts[Math.floor(Math.random() * (amounts.length - 1))]!
      }
    ],
    // Empty slots (generic trade)
    () => []
  ];

  // Pick a random combination

  const selectedCombination = slotCombinations[Math.floor(Math.random() * slotCombinations.length)];
  return selectedCombination();
};
