import { chainId, withForkAliases } from '@/utils/chainId';

export const SAFE_CONNECTOR_ID = 'safe';

// The Tenderly forks ask their real chain's service, as `tenderly` asks mainnet's.
export const SAFE_TRANSACTION_SERVICE_URL: Record<number, string> = withForkAliases({
  [chainId.mainnet]: 'https://safe-transaction-mainnet.safe.global',
  [chainId.base]: 'https://safe-transaction-base.safe.global',
  [chainId.arbitrum]: 'https://safe-transaction-arbitrum.safe.global',
  [chainId.tenderly]: 'https://safe-transaction-mainnet.safe.global',
  [chainId.optimism]: 'https://safe-transaction-optimism.safe.global',
  [chainId.unichain]: 'https://safe-transaction-unichain.safe.global'
});

export enum CapabilitySupportStatus {
  supported = 'supported',
  ready = 'ready'
}
