import {
  usdcRiskCapitalVaultAddress,
  usdsFlagshipVaultAddress,
  usdsRiskCapitalVaultAddress,
  usdtRiskCapitalVaultAddress,
  usdtSavingsVaultAddress
} from '../generated';
import { TOKENS } from '../tokens/tokens.constants';
import { MorphoVaultConfig } from './morpho';

export const MORPHO_API_URL = 'https://api.morpho.org/graphql';
export const MERKL_API_URL = 'https://api.merkl.xyz/v4';

export enum MorphoAdapterType {
  MetaMorpho = 'MetaMorpho',
  MorphoMarketV1 = 'MorphoMarketV1'
}

export enum MorphoTransactionType {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw'
}

/**
 * List of all supported Morpho vaults
 * To add a new vault, simply add a new entry to this array
 */
export const MORPHO_VAULTS: MorphoVaultConfig[] = [
  {
    name: 'USDT Savings',
    vaultAddress: usdtSavingsVaultAddress,
    assetToken: TOKENS.usdt
  },
  {
    name: 'USDS Flagship',
    vaultAddress: usdsFlagshipVaultAddress,
    assetToken: TOKENS.usds
  },
  {
    name: 'USDS Risk Capital',
    vaultAddress: usdsRiskCapitalVaultAddress,
    assetToken: TOKENS.usds
  },
  {
    name: 'USDT Risk Capital',
    vaultAddress: usdtRiskCapitalVaultAddress,
    assetToken: TOKENS.usdt
  },
  {
    name: 'USDC Risk Capital',
    vaultAddress: usdcRiskCapitalVaultAddress,
    assetToken: TOKENS.usdc
  }
];

/**
 * Get a Morpho vault config by its address for a specific chain
 */
export function getMorphoVaultByAddress(
  address: `0x${string}`,
  chainId: number
): MorphoVaultConfig | undefined {
  return MORPHO_VAULTS.find(vault => vault.vaultAddress[chainId]?.toLowerCase() === address.toLowerCase());
}

/**
 * Minimal ABI for MorphoVaultV1Adapter to read the underlying V1 vault address and real assets.
 */
export const MORPHO_VAULT_V1_ADAPTER_ABI = [
  {
    inputs: [],
    name: 'morphoVaultV1',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'realAssets',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Minimal ABI for MorphoMarketV1Adapter to read market IDs and real assets.
 * Each adapter can allocate to multiple markets.
 */
export const MORPHO_MARKET_V1_ADAPTER_ABI = [
  {
    inputs: [],
    name: 'marketIdsLength',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ type: 'uint256' }],
    name: 'marketIds',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'realAssets',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'marketId', type: 'bytes32' }],
    name: 'expectedSupplyAssets',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * GraphQL query for Morpho V2 vault adapters.
 * V2 vaults allocate to V1 vaults through adapters.
 */
export const VAULT_V2_ADAPTERS_QUERY = `
  query VaultV2Adapters($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      symbol
      asset {
        symbol
        decimals
      }
      totalAssets
      totalAssetsUsd
      idleAssetsUsd
      adapters {
        items {
          address
          assets
          assetsUsd
          type
        }
      }
    }
  }
`;

/**
 * GraphQL query for Morpho V1 vault basic data (name, symbol, net APY).
 */
export const VAULT_V1_BASIC_DATA_QUERY = `
  query VaultV1BasicData($address: String!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      state {
        netApy
      }
    }
  }
`;

/**
 * GraphQL query for Morpho market data.
 */
export const MARKET_DATA_QUERY = `
  query MarketData($marketId: String!, $chainId: Int!) {
    marketByUniqueKey(uniqueKey: $marketId, chainId: $chainId) {
      uniqueKey
      lltv
      loanAsset {
        symbol
      }
      collateralAsset {
        symbol
      }
      state {
        supplyAssets
        borrowAssets
        utilization
        avgNetSupplyApy
      }
    }
  }
`;

/**
 * GraphQL query for Morpho V2 vault transactions (deposits and withdrawals).
 */
export const VAULT_V2_TRANSACTIONS_QUERY = `
  query VaultV2Transactions(
    $chainId: Int!
    $userAddress: String!
    $vaultAddresses: [String!]!
  ) {
    vaultV2transactions(
      orderBy: Time
      orderDirection: Desc
      where: {
        chainId_in: [$chainId]
        userAddress_in: [$userAddress]
        vaultAddress_in: $vaultAddresses
        type_in: [Deposit, Withdraw]
      }
    ) {
      items {
        vault {
          address
          asset {
            symbol
            decimals
          }
        }
        type
        timestamp
        txHash
        data {
          ... on VaultV2DepositData {
            assets
          }
          ... on VaultV2WithdrawData {
            assets
          }
        }
      }
    }
  }
`;

export const VAULT_V2_HISTORICAL_QUERY = `
  query VaultV2History($address: String!, $chainId: Int!, $endTimestamp: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      historicalState {
        totalAssets(options: { startTimestamp: 0, endTimestamp: $endTimestamp, interval: DAY }) {
          x
          y
        }
        avgNetApy(options:{ startTimestamp: 0, endTimestamp: $endTimestamp, interval: DAY }) {
          x
          y
        }
      }
    }
  }
`;

export const VAULT_V2_HISTORICAL_HOURLY_QUERY = `
  query VaultV2HistoryHourly($address: String!, $chainId: Int!, $startTimestamp: Int!, $endTimestamp: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      historicalState {
        totalAssets(options: { startTimestamp: $startTimestamp, endTimestamp: $endTimestamp, interval: HOUR }) {
          x
          y
        }
        avgNetApy(options:{ startTimestamp: $startTimestamp, endTimestamp: $endTimestamp, interval: HOUR }) {
          x
          y
        }
      }
    }
  }
`;

/**
 * GraphQL query for Morpho V2 vault positions (depositors) with pagination.
 * Includes shares to filter for active suppliers client-side (API doesn't support where clause).
 */
export const VAULT_V2_POSITIONS_QUERY = `
  query VaultV2Positions($address: String!, $chainId: Int!, $first: Int!, $skip: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      positions(first: $first, skip: $skip) {
        items {
          user {
            address
          }
          shares
        }
      }
    }
  }
`;

/**
 * GraphQL query for Morpho V2 vault data with caps-based market discovery.
 * Uses the caps field with inline fragments to get market data for MarketV1 caps,
 * eliminating the need for separate market queries or on-chain adapter reads.
 */
export const VAULT_MARKET_DATA_QUERY = `
  query VaultMarketData($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      avgApy
      avgNetApy
      performanceFee
      managementFee
      rewards {
        supplyApr
        asset {
          symbol
          logoURI
        }
      }
      totalAssets
      totalAssetsUsd
      totalSupply
      idleAssets
      idleAssetsUsd
      liquidity
      asset {
        decimals
        symbol
      }
      caps {
        items {
          type
          data {
            ... on MarketV1CapData {
              market {
                uniqueKey
                lltv
                loanAsset { symbol }
                collateralAsset { symbol }
                state {
                  supplyAssets
                  borrowAssets
                  utilization
                  avgNetSupplyApy
                }
              }
            }
          }
          absoluteCap
          relativeCap
          allocation
        }
      }
    }
  }
`;
