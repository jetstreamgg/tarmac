import { TRADE_ARBITRUM } from '../../lib/intentClassificationOptions';

export const generateRandomResponse = () => {
  // ... existing code ...
  const responses = [
    'I can help you with that! Learn more at [sky.money](https://sky.money)',
    "Here's what I found about your request. Visit [sky.money](https://sky.money) for more details",
    'Let me assist you with that. Check out [sky.money](https://sky.money)',
    'I understand you want to know more. Explore [sky.money](https://sky.money) for additional information'
  ];
  // ... existing code ...
  return responses[Math.floor(Math.random() * responses.length)];
};

export const generateRandomIntent = () => {
  const intents = [
    // TRADE,
    // TRADE_MAINNET,
    // TRADE_BASE,
    TRADE_ARBITRUM,
    // UPGRADE,
    // SAVINGS,
    // SAVINGS_MAINNET,
    // SAVINGS_BASE,
    // SAVINGS_ARBITRUM,
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
  if (intent?.startsWith('SAVINGS')) {
    // Token options depend on the network
    const tokens = intent.startsWith('SAVINGS_') ? ['USDS', 'USDC'] : ['USDS'];
    const amounts = ['0.1', '1', '10', '100', '1000', undefined];
    const tabs = ['left', 'right', undefined]; // left=supply, right=withdraw

    // Different combinations of slots for savings intents
    const slotCombinations = [
      // Complete savings info with amount and tab
      () => [
        {
          field: 'source_token',
          parsed_value: tokens[Math.floor(Math.random() * tokens.length)]
        },
        {
          field: 'input_amount',
          parsed_value: amounts[Math.floor(Math.random() * (amounts.length - 1))]!
        },
        {
          field: 'tab',
          parsed_value: tabs[Math.floor(Math.random() * (tabs.length - 1))]!
        }
      ],
      // Token and amount only
      () => [
        {
          field: 'source_token',
          parsed_value: tokens[Math.floor(Math.random() * tokens.length)]
        },
        {
          field: 'input_amount',
          parsed_value: amounts[Math.floor(Math.random() * (amounts.length - 1))]!
        }
      ],
      // Token and tab only
      () => [
        {
          field: 'source_token',
          parsed_value: tokens[Math.floor(Math.random() * tokens.length)]
        },
        {
          field: 'tab',
          parsed_value: tabs[Math.floor(Math.random() * (tabs.length - 1))]!
        }
      ],
      // Amount and tab only
      () => [
        {
          field: 'input_amount',
          parsed_value: amounts[Math.floor(Math.random() * (amounts.length - 1))]!
        },
        {
          field: 'tab',
          parsed_value: tabs[Math.floor(Math.random() * (tabs.length - 1))]!
        }
      ],
      // Only token
      () => [
        {
          field: 'source_token',
          parsed_value: tokens[Math.floor(Math.random() * tokens.length)]
        }
      ],
      // Only tab
      () => [
        {
          field: 'tab',
          parsed_value: tabs[Math.floor(Math.random() * (tabs.length - 1))]!
        }
      ],
      // Empty slots (generic savings)
      () => []
    ];

    const selectedCombination = slotCombinations[Math.floor(Math.random() * slotCombinations.length)];
    return selectedCombination();
  }

  if (intent?.startsWith('TRADE')) {
    // Trade-specific mock data
    const sourceTokens = intent.startsWith('TRADE_')
      ? ['USDC', 'USDS', 'sUSDS']
      : ['DAI', 'USDC', 'USDT', 'ETH', 'USDS', 'MKR', 'SKY'];
    const targetTokens = intent.startsWith('TRADE_')
      ? ['USDC', 'USDS', 'sUSDS']
      : ['DAI', 'USDC', 'USDT', 'ETH', 'USDS', 'MKR', 'SKY'];
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
          field: 'input_amount',
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
          field: 'input_amount',
          parsed_value: amounts[Math.floor(Math.random() * (amounts.length - 1))]!
        }
      ],
      // Empty slots (generic trade)
      () => []
    ];
    // Pick a random combination

    const selectedCombination = slotCombinations[Math.floor(Math.random() * slotCombinations.length)];
    return selectedCombination();
  }

  const tokens = ['DAI', 'USDC', 'USDT', 'ETH', 'USDS'];
  return [
    {
      field: 'source_token',
      parsed_value: tokens[Math.floor(Math.random() * tokens.length)]
    },
    {
      field: 'input_amount',
      parsed_value: Math.floor(Math.random() * 1000).toString()
    }
  ];
};
