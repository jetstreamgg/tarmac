import { arbitrum, base, mainnet } from 'wagmi/chains';
import createClient from 'openapi-fetch';
import { paths } from './cowApiSchema';
import { TENDERLY_CHAIN_ID } from '../constants';

export enum TradeSide {
  IN = 'IN',
  OUT = 'OUT'
}

const COW_API_ENDPOINT = {
  [mainnet.id]: 'https://api.cow.fi/mainnet',
  [base.id]: 'https://api.cow.fi/base',
  [arbitrum.id]: 'https://api.cow.fi/arbitrum_one'
} as const;

export enum OrderQuoteSideKind {
  BUY = 'buy',
  SELL = 'sell'
}

export enum OrderBalance {
  ERC20 = 'erc20',
  INTERNAL = 'internal',
  EXTERNAL = 'external'
}

export enum OrderStatus {
  presignaturePending = 'presignaturePending',
  open = 'open',
  fulfilled = 'fulfilled',
  cancelled = 'cancelled',
  expired = 'expired'
}

export const SKY_MONEY_APP_CODE = 'sky.money';

export const ORDER_TYPE_FIELDS = [
  { name: 'sellToken', type: 'address' },
  { name: 'buyToken', type: 'address' },
  { name: 'receiver', type: 'address' },
  { name: 'sellAmount', type: 'uint256' },
  { name: 'buyAmount', type: 'uint256' },
  { name: 'validTo', type: 'uint32' },
  { name: 'appData', type: 'bytes32' },
  { name: 'feeAmount', type: 'uint256' },
  { name: 'kind', type: 'string' },
  { name: 'partiallyFillable', type: 'bool' },
  { name: 'sellTokenBalance', type: 'string' },
  { name: 'buyTokenBalance', type: 'string' }
] as const;

export const ETH_FLOW_QUOTE_PARAMS = {
  signingScheme: 'eip1271',
  onchainOrder: true,
  verificationGasLimit: 0
} as const;

export const gpv2VaultRelayerAddress = {
  [mainnet.id]: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
  [base.id]: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
  [arbitrum.id]: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
  [TENDERLY_CHAIN_ID]: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110'
} as const;

export const cowApiClient = {
  [mainnet.id]: createClient<paths>({ baseUrl: COW_API_ENDPOINT[mainnet.id] }),
  [base.id]: createClient<paths>({ baseUrl: COW_API_ENDPOINT[base.id] }),
  [arbitrum.id]: createClient<paths>({ baseUrl: COW_API_ENDPOINT[arbitrum.id] }),
  [TENDERLY_CHAIN_ID]: createClient<paths>({ baseUrl: COW_API_ENDPOINT[mainnet.id] })
} as const;
