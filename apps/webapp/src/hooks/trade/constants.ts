import { arbitrum, base, mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../constants';

const COW_API_MAINNET = 'https://api.cow.fi/mainnet';

export const COW_API_ENDPOINT: Partial<Record<number, string>> = {
  [mainnet.id]: COW_API_MAINNET,
  [base.id]: 'https://api.cow.fi/base',
  [arbitrum.id]: 'https://api.cow.fi/arbitrum_one',
  // Tenderly forks mainnet, so its trade history is mainnet's.
  [TENDERLY_CHAIN_ID]: COW_API_MAINNET
};

export enum OrderStatus {
  presignaturePending = 'presignaturePending',
  open = 'open',
  fulfilled = 'fulfilled',
  cancelled = 'cancelled',
  expired = 'expired'
}

export const SKY_MONEY_APP_CODE = 'sky.money';
