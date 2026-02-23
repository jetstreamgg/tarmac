export type OnchainEventType =
  | 'supply'
  | 'withdraw'
  | 'trade'
  | 'upgrade'
  | 'revert'
  | 'stake'
  | 'unstake'
  | 'borrow'
  | 'repay'
  | 'reward_claimed';

export interface OnchainEventData {
  event_type: OnchainEventType;
  /** ISO 8601 timestamp from subgraph blockTimestamp */
  date: string;
  /** Human-readable amount, signed: positive for supply/upgrade/stake/borrow, negative for withdraw/revert/unstake/repay. 0 for reward_claimed (amounts in claimed_<TOKEN> keys). */
  amount: number;
  token_symbol: string;

  // Swap-specific
  amount_from?: number;
  amount_to?: number;
  token_address_from?: string;
  token_address_to?: string;
  token_symbol_from?: string;
  token_symbol_to?: string;

  // Staking/Seal
  borrow_amount?: number;
  borrow_type?: 'borrow' | 'repay';
  urn_index?: number;

  // Reward claimed — dynamic keys: claimed_SKY, claimed_SPK, etc.
  [claimedKey: `claimed_${string}`]: number | undefined;

  // Sub-product within a widget (e.g., reward contract name, vault name, 'stUSDS')
  product?: string | null;
  // Contract address for the selected product (reward contract, vault contract, etc.)
  product_address?: string;
}
