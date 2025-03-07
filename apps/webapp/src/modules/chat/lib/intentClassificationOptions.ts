export const TRADE = 'TRADE';
export const TRADE_MAINNET = 'TRADE_MAINNET';
export const TRADE_BASE = 'TRADE_BASE';
export const TRADE_ARBITRUM = 'TRADE_ARBITRUM';
export const REWARDS = 'REWARDS';
export const UPGRADE = 'UPGRADE';
export const SAVINGS = 'SAVINGS';
export const SAVINGS_MAINNET = 'SAVINGS_MAINNET';
export const SAVINGS_BASE = 'SAVINGS_BASE';
export const SAVINGS_ARBITRUM = 'SAVINGS_ARBITRUM';

export const actionIntentClassificationOptions = [
  {
    name: TRADE,
    description:
      'The user wants to perform a cryptocurrency trade from one currency to another. This might look like "trade <currency> to <currency>" or "I want to trade <currency> to <currency>".'
  },
  {
    name: TRADE_MAINNET,
    description:
      'The user wants to perform a cryptocurrency trade specifically on Ethereum Mainnet. This might look like "trade <currency> to <currency> on mainnet" or "I want to trade <currency> to <currency> on ethereum".'
  },
  {
    name: TRADE_BASE,
    description:
      'The user wants to perform a cryptocurrency trade specifically on Base. This might look like "trade <currency> to <currency> on base" or "I want to trade <currency> to <currency> on base".'
  },
  {
    name: TRADE_ARBITRUM,
    description:
      'The user wants to perform a cryptocurrency trade specifically on Arbitrum. This might look like "trade <currency> to <currency> on arbitrum" or "I want to trade <currency> to <currency> on arbitrum".'
  },
  {
    name: REWARDS,
    description: 'The user wants to earn rewards by using one token to get another token as a reward.'
  },
  {
    name: UPGRADE,
    description:
      'The user wants to upgrade their cryptocurrency, such as converting DAI to USDS or MKR to SKY.'
  },
  {
    name: SAVINGS,
    description: 'The user wants to deposit USDS into savings to earn yield.'
  },
  {
    name: SAVINGS_MAINNET,
    description: 'The user wants to deposit USDS into savings to earn yield specifically on Ethereum Mainnet.'
  },
  {
    name: SAVINGS_BASE,
    description: 'The user wants to deposit USDS into savings to earn yield specifically on Base.'
  },
  {
    name: SAVINGS_ARBITRUM,
    description: 'The user wants to deposit USDS into savings to earn yield specifically on Arbitrum.'
  }
];
