import { mainnet } from 'viem/chains';
import {
  usdcRiskCapitalVaultAddress,
  usdsFlagshipVaultAddress,
  usdsRiskCapitalVaultAddress,
  usdtRiskCapitalVaultAddress,
  usdtSavingsVaultAddress
} from '../generated';
import { TOKENS } from '../tokens/tokens.constants';
import { MorphoVaultConfig } from './morpho';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import type { DataSource } from '../hooks';

export const MORPHO_API_URL = 'https://api.morpho.org/graphql';

/** The Morpho GraphQL API as a read hook's data source. */
export function morphoDataSource(): DataSource {
  return {
    title: 'Morpho API',
    href: MORPHO_API_URL,
    onChain: false,
    trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
  };
}
/** Morpho vaults (and their Merkl campaigns) are mainnet-only — always query the APIs with this chainId. */
export const MORPHO_API_CHAIN_ID = mainnet.id;
export const MERKL_API_URL = `${import.meta.env?.VITE_PROXY_ORIGIN || 'https://staging-proxy.sky.money'}/merkl/v4`;

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
    provider: 'morpho',
    name: 'USDT Savings',
    vaultAddress: usdtSavingsVaultAddress,
    riskProfile: 'vault-usdt-savings',
    assetToken: TOKENS.usdt
  },
  {
    provider: 'morpho',
    name: 'USDS Flagship',
    vaultAddress: usdsFlagshipVaultAddress,
    riskProfile: 'vault-flagship',
    assetToken: TOKENS.usds
  },
  {
    provider: 'morpho',
    name: 'USDS Risk Capital',
    vaultAddress: usdsRiskCapitalVaultAddress,
    riskProfile: 'vault-risk-capital',
    assetToken: TOKENS.usds
  },
  {
    provider: 'morpho',
    name: 'USDT Risk Capital',
    vaultAddress: usdtRiskCapitalVaultAddress,
    riskProfile: 'vault-risk-capital',
    assetToken: TOKENS.usdt
  },
  {
    provider: 'morpho',
    name: 'USDC Risk Capital',
    vaultAddress: usdcRiskCapitalVaultAddress,
    riskProfile: 'vault-risk-capital',
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

/**
 * Per-user V2 position PnL plus a daily balance series for the earnings window.
 * `pnl`/`assets`/series `y` serialize as string above 2^53 and number below;
 * the series comes back newest-first. Exited positions keep their PnL.
 */
export const USER_VAULT_V2_PNL_QUERY = `
  query UserVaultV2Pnl($userAddress: String!, $chainId: Int!, $startTimestamp: Int!, $endTimestamp: Int!) {
    userByAddress(address: $userAddress, chainId: $chainId) {
      vaultV2Positions {
        vault {
          address
          asset {
            symbol
            decimals
          }
        }
        assets
        assetsUsd
        pnl
        pnlUsd
        roe
        history {
          assets(options: { startTimestamp: $startTimestamp, endTimestamp: $endTimestamp, interval: DAY }) {
            x
            y
          }
        }
      }
    }
  }
`;

/**
 * VAULT_V2_TRANSACTIONS_QUERY variant scoped to a window start via
 * `timestamp_gte` (an Int, not a BigInt) — the monthly flows method only needs
 * in-window deposits and withdrawals, not the wallet's whole history.
 */
export const VAULT_V2_TRANSACTIONS_SINCE_QUERY = `
  query VaultV2TransactionsSince(
    $chainId: Int!
    $userAddress: String!
    $vaultAddresses: [String!]!
    $sinceTimestamp: Int!
  ) {
    vaultV2transactions(
      orderBy: Time
      orderDirection: Desc
      where: {
        chainId_in: [$chainId]
        userAddress_in: [$userAddress]
        vaultAddress_in: $vaultAddresses
        type_in: [Deposit, Withdraw]
        timestamp_gte: $sinceTimestamp
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
        totalAssetsUsd(options: { startTimestamp: 0, endTimestamp: $endTimestamp, interval: DAY }) {
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

/**
 * Builds a query for the trailing daily net-APY series of SEVERAL vaults at
 * once, one aliased `vaultV2ByAddress` selection per address. The marketplace
 * table needs a 30D rate for every Morpho vault on page load; reusing
 * VAULT_V2_HISTORICAL_QUERY would mean one request per vault, each carrying the
 * vault's whole lifetime of TVL + APY. This asks only for the APY series inside
 * the requested window, in a single round trip.
 *
 * Addresses are passed as GraphQL variables (`$a0`, `$a1`, …) rather than
 * interpolated into the document.
 */
export function buildVaultV2ApyWindowQuery(addressCount: number): string {
  const addressVars = Array.from({ length: addressCount }, (_, i) => `$a${i}: String!`).join(', ');
  const selections = Array.from(
    { length: addressCount },
    (_, i) => `
    v${i}: vaultV2ByAddress(address: $a${i}, chainId: $chainId) {
      address
      historicalState {
        avgNetApy(options: { startTimestamp: $startTimestamp, endTimestamp: $endTimestamp, interval: DAY }) {
          x
          y
        }
      }
    }`
  ).join('');

  return `
  query VaultV2ApyWindow($chainId: Int!, $startTimestamp: Int!, $endTimestamp: Int!, ${addressVars}) {${selections}
  }
`;
}

export const VAULT_V2_HISTORICAL_HOURLY_QUERY = `
  query VaultV2HistoryHourly($address: String!, $chainId: Int!, $startTimestamp: Int!, $endTimestamp: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      historicalState {
        totalAssets(options: { startTimestamp: $startTimestamp, endTimestamp: $endTimestamp, interval: HOUR }) {
          x
          y
        }
        totalAssetsUsd(options: { startTimestamp: $startTimestamp, endTimestamp: $endTimestamp, interval: HOUR }) {
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
 * GraphQL query for Morpho V2 vault data with caps-based market discovery.
 * Uses the caps field with inline fragments to get market data for MarketV1 caps,
 * eliminating the need for separate market queries or on-chain adapter reads.
 */
export const VAULT_MARKET_DATA_QUERY = `
  query VaultMarketData($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      apy
      netApy
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
                marketId
                lltv
                loanAsset { symbol }
                collateralAsset { symbol }
                state {
                  supplyAssets
                  borrowAssets
                  utilization
                  netSupplyApy
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
