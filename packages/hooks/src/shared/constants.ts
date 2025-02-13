import { chainId } from '@jetstreamgg/utils';

export const SAFE_CONNECTOR_ID = 'safe';

export const SAFE_TRANSACTION_SERVICE_URL: Record<number, string> = {
  [chainId.mainnet]: 'https://safe-transaction-mainnet.safe.global',
  [chainId.base]: 'https://safe-transaction-base.safe.global',
  [chainId.sepolia]: 'https://safe-transaction-sepolia.safe.global',
  [chainId.tenderly]: 'https://safe-transaction-mainnet.safe.global',
  [chainId.tenderlyBase]: 'https://safe-transaction-base.safe.global'
};
