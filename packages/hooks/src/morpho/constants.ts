import { usdsRiskCapitalVaultAddress } from '../generated';
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
    name: 'USDS Risk Capital',
    vaultAddress: usdsRiskCapitalVaultAddress,
    assetToken: TOKENS.usds
  }
  // Add more vaults here as needed:
  // {
  //   name: 'Another Vault Name',
  //   vaultAddress: anotherVaultAddress,
  //   assetToken: TOKENS.usds
  // }
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
      loanAsset {
        symbol
      }
      collateralAsset {
        symbol
      }
      state {
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
        chainId_in: $chainId
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
