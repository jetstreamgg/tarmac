// this list cannot come dynamically from trade list because we may support tokens in some modules that we do not support trading for
export const slotTokenList = ['MKR', 'DAI', 'USDC', 'USDT', 'USDC', 'WETH', 'ETH', 'USDS', 'SKY'];

export const slotDefinitions = [
  {
    field: 'source_token',
    description:
      'The currency the user wants to use as the source of their transaction, likely to end up with a different currency. The currency is typically represented by three or four letters. For example, "MKR", "DAI", "USDC", "USDT", "USDC", "WETH", "ETH", "USDS", "SKY"',
    slot_type: 'TEXT',
    choices: slotTokenList
  },
  {
    field: 'target_token',
    description:
      'The currency the user wants to end up with at the end of the transaction. They will start with another currency and end with this one. The currency is typically represented by three or four letters. For example, "MKR", "DAI", "USDC", "USDT", "USDC", "WETH", "ETH", "USDS", "SKY"',
    slot_type: 'TEXT',
    choices: slotTokenList
  },
  {
    field: 'amount',
    description: 'The amount the user wants to transact',
    slot_type: 'NUMBER'
  }
];
