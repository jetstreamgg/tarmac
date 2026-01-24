import { TrustLevel } from './hooks';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const TRUST_LEVELS: Record<TrustLevelEnum, TrustLevel> = {
  0: {
    level: 0,
    title: 'Trust Level 0',
    description:
      'Data from this trust level can include data directly from calls to the Ethereum nodes via various RPC endpoints.'
  },
  1: {
    level: 1,
    title: 'Trust Level 1',
    description:
      'Data from this trust level can include data from an indexed data solution such as The Graph or Dune Analytics. The on-chain data is indexed by third-parties with varying levels of trust'
  },
  2: {
    level: 2,
    title: 'Trust Level 2',
    description:
      'Data from this trust level can include data from trust third-parties such as GitHub or other centralized APIs. The data is not on-chain.'
  }
};

export enum TrustLevelEnum {
  ZERO,
  ONE,
  TWO
}

export const URL_MAKER_SUBGRAPH_MAINNET =
  'https://query-subgraph.sky.money/subgraphs/name/jetstreamgg/sky-subgraph-mainnet';
export const URL_MAKER_SUBGRAPH_TENDERLY =
  'https://query-subgraph-staging.sky.money/subgraphs/name/jetstreamgg/sky-subgraph-testnet';

export const URL_BASE_SUBGRAPH_MAINNET =
  'https://query-subgraph.sky.money/subgraphs/name/jetstreamgg/sky-subgraph-base';

export const URL_ARBITRUM_SUBGRAPH_MAINNET =
  'https://query-subgraph.sky.money/subgraphs/name/jetstreamgg/sky-subgraph-arbitrum';

export const URL_OPTIMISM_SUBGRAPH_MAINNET =
  'https://query-subgraph.sky.money/subgraphs/name/jetstreamgg/sky-subgraph-optimism';

export const URL_UNICHAIN_SUBGRAPH_MAINNET =
  'https://query-subgraph.sky.money/subgraphs/name/jetstreamgg/sky-subgraph-unichain';

export const URL_BLOCKS_SUBGRAPH_MAINNET =
  'https://gateway-arbitrum.network.thegraph.com/api/937ce273344a610ea828ebe9702f6b65/subgraphs/id/9A6bkprqEG2XsZUYJ5B2XXp6ymz9fNcn4tVPxMWDztYC';
export const URL_BA_LABS_API_MAINNET = 'https://info-sky.blockanalitica.com/api/v1';

export const BASE_CHAIN_ID = 8453;
export const ARBITRUM_CHAIN_ID = 42161;
export const OPTIMISM_CHAIN_ID = 10;
export const UNICHAIN_CHAIN_ID = 130;

export const TENDERLY_CHAIN_ID = 314310;

export enum ModuleEnum {
  SAVINGS = 'SAVINGS',
  UPGRADE = 'UPGRADE',
  TRADE = 'TRADE',
  REWARDS = 'REWARDS',
  SEAL = 'SEAL',
  STAKE = 'STAKE',
  STUSDS = 'STUSDS',
  MORPHO = 'MORPHO'
}

export enum TransactionTypeEnum {
  DAI_TO_USDS = 'DAI_TO_USDS',
  MKR_TO_SKY = 'MKR_TO_SKY',
  SKY_TO_MKR = 'SKY_TO_MKR',
  USDS_TO_DAI = 'USDS_TO_DAI',
  TRADE = 'TRADE',
  SUPPLY = 'SUPPLY',
  WITHDRAW = 'WITHDRAW',
  REWARD = 'REWARD',
  OPEN = 'OPEN',
  SELECT_DELEGATE = 'SELECT_DELEGATE',
  SELECT_REWARD = 'SELECT_REWARD',
  SEAL = 'SEAL',
  SEAL_SKY = 'SEAL_SKY',
  UNSEAL = 'UNSEAL',
  UNSEAL_SKY = 'UNSEAL_SKY',
  BORROW = 'BORROW',
  REPAY = 'REPAY',
  SEAL_REWARD = 'SEAL_REWARD',
  UNSEAL_KICK = 'UNSEAL_KICK',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
  FREE = 'FREE',
  STAKE_BORROW = 'STAKE_BORROW',
  STAKE_REPAY = 'STAKE_REPAY',
  STAKE_REWARD = 'STAKE_REWARD',
  UNSTAKE_KICK = 'UNSTAKE_KICK',
  STAKE_OPEN = 'STAKE_OPEN',
  STAKE_SELECT_DELEGATE = 'STAKE_SELECT_DELEGATE',
  STAKE_SELECT_REWARD = 'STAKE_SELECT_REWARD'
}
