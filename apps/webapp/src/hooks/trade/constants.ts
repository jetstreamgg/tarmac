import { arbitrum, base, mainnet } from 'wagmi/chains';
import createClient from 'openapi-fetch';
import { paths } from './cowApiSchema';
import { TENDERLY_CHAIN_ID } from '../constants';

const COW_API_ENDPOINT = {
  [mainnet.id]: 'https://api.cow.fi/mainnet',
  [base.id]: 'https://api.cow.fi/base',
  [arbitrum.id]: 'https://api.cow.fi/arbitrum_one'
} as const;

export enum OrderStatus {
  presignaturePending = 'presignaturePending',
  open = 'open',
  fulfilled = 'fulfilled',
  cancelled = 'cancelled',
  expired = 'expired'
}

export const SKY_MONEY_APP_CODE = 'sky.money';

export const cowApiClient = {
  [mainnet.id]: createClient<paths>({ baseUrl: COW_API_ENDPOINT[mainnet.id] }),
  [base.id]: createClient<paths>({ baseUrl: COW_API_ENDPOINT[base.id] }),
  [arbitrum.id]: createClient<paths>({ baseUrl: COW_API_ENDPOINT[arbitrum.id] }),
  [TENDERLY_CHAIN_ID]: createClient<paths>({ baseUrl: COW_API_ENDPOINT[mainnet.id] })
} as const;
