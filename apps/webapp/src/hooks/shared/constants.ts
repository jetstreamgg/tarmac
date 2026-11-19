import { chainId } from '@/utils';

export const SAFE_CONNECTOR_ID = 'safe';

export const SAFE_TRANSACTION_SERVICE_URL: Record<number, string> = {
  [chainId.mainnet]: 'https://api.safe.global/tx-service/eth',
  [chainId.base]: 'https://api.safe.global/tx-service/base',
  [chainId.arbitrum]: 'https://api.safe.global/tx-service/arb1',
  [chainId.tenderly]: 'https://api.safe.global/tx-service/eth',
  [chainId.optimism]: 'https://api.safe.global/tx-service/oeth',
  [chainId.unichain]: 'https://api.safe.global/tx-service/unichain'
};

export enum CapabilitySupportStatus {
  supported = 'supported',
  ready = 'ready'
}
