import { arbitrum, base, mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../constants';

export const COW_API_ENDPOINT: Partial<Record<number, string>> = {
  [mainnet.id]: 'https://api.cow.fi/mainnet',
  [base.id]: 'https://api.cow.fi/base',
  [arbitrum.id]: 'https://api.cow.fi/arbitrum_one',
  [TENDERLY_CHAIN_ID]: 'https://api.cow.fi/mainnet'
};

export enum OrderStatus {
  presignaturePending = 'presignaturePending',
  open = 'open',
  fulfilled = 'fulfilled',
  cancelled = 'cancelled',
  expired = 'expired'
}

export const SKY_MONEY_APP_CODE = 'sky.money';
