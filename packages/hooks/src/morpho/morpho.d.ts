import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { ReadHook } from '../hooks';
import { Token } from '../tokens/types';
import { MorphoTransactionType } from './constants';

/**
 * Configuration for a Morpho vault
 */
export type MorphoVaultConfig = {
  /** Display name for the vault */
  name: string;
  /** The vault contract address mapping by chain ID (also serves as the unique identifier) */
  vaultAddress: Record<number, `0x${string}`>;
  /** The underlying asset token */
  assetToken: Token;
  /** The primary market ID the vault allocates to (required for useMorphoVaultSingleMarketApiData) */
  marketId?: `0x${string}`;
};

/**
 * API response type for Morpho V2 vault adapters query.
 */
export type MorphoVaultV2AdaptersApiResponse = {
  data: {
    vaultV2ByAddress: {
      address: string;
      symbol: string;
      asset: {
        symbol: string;
        decimals: number;
      };
      totalAssets: string;
      totalAssetsUsd: number;
      /** Idle (undeployed) assets in USD */
      idleAssetsUsd: number;
      adapters: {
        items: Array<{
          address: string;
          assets: string;
          assetsUsd: number;
          type: string;
        }>;
      };
    } | null;
  };
};

/**
 * API response type for Morpho V1 vault basic data query (name only, no allocations).
 */
export type MorphoVaultV1BasicDataApiResponse = {
  data: {
    vaultByAddress: {
      address: string;
      name: string;
      symbol: string;
      state: {
        netApy: number;
      };
    } | null;
  };
};

/** V1 vault allocation from the V2 vault */
export type MorphoV1VaultAllocation = {
  /** V1 vault contract address */
  vaultAddress: `0x${string}`;
  /** V1 vault name (e.g., "Steakhouse USDC") */
  vaultName: string;
  /** Formatted assets allocation (e.g., "5.93M") */
  formattedAssets: string;
  /** Formatted assets in USD (e.g., "$5.93M") */
  formattedAssetsUsd: string;
  /** Formatted net APY (e.g., "3.68%") */
  formattedNetApy: string;
};

/** Idle liquidity allocation (direct market exposure without collateral) */
export type MorphoIdleLiquidityAllocation = {
  /** Asset symbol (e.g., "USDC") */
  assetSymbol: string;
  /** Formatted assets allocation (e.g., "0") */
  formattedAssets: string;
  /** Formatted assets in USD (e.g., "$0") */
  formattedAssetsUsd: string;
};

/** Direct Morpho market allocation */
export type MorphoMarketAllocation = {
  /** Market ID (32-byte hash) */
  marketId: string;
  /** Market unique key (for display) */
  marketUniqueKey: string;
  /** Loan asset symbol */
  loanAsset: string;
  /** Collateral asset symbol */
  collateralAsset: string;
  /** Formatted assets allocation (e.g., "5.93M") */
  formattedAssets: string;
  /** Formatted assets in USD (e.g., "$5.93M") */
  formattedAssetsUsd: string;
  /** Formatted net APY (e.g., "3.68%") */
  formattedNetApy: string;
  /** Total assets supplied to the market */
  totalSupplyAssets: bigint;
  /** Total assets borrowed from the market */
  totalBorrowAssets: bigint;
  /** Available liquidity (totalSupplyAssets - totalBorrowAssets) */
  liquidity: bigint;
  /** Utilization rate as a decimal (0-1), e.g., 0.85 = 85% */
  utilization: number;
  /** Liquidation Loan-To-Value (WAD, 18 decimals) */
  lltv: bigint;
  /** Formatted LLTV as a percentage (e.g., "86%") */
  formattedLltv: string;
};

export type MorphoVaultAllocationsData = {
  /** List of V1 vault allocations */
  v1Vaults: MorphoV1VaultAllocation[];
  /** List of direct market allocations */
  markets: MorphoMarketAllocation[];
  /** Idle liquidity allocations */
  idleLiquidity: MorphoIdleLiquidityAllocation[];
  /** Asset symbol (e.g., "USDC") */
  assetSymbol: string;
};

export type MorphoVaultAllocationsHook = ReadHook & {
  data?: MorphoVaultAllocationsData;
};

export type MorphoVaultV2Transaction = {
  vault: {
    address: string;
    asset: {
      symbol: string;
      decimals: number;
    };
  };
  type: MorphoTransactionType;
  timestamp: number;
  txHash: string;
  data: {
    assets: string;
  };
};

/**
 * API response type for Morpho V2 vault transactions query.
 */
export type MorphoVaultV2TransactionsApiResponse = {
  data: {
    vaultV2transactions: {
      items: Array<MorphoVaultV2Transaction>;
    };
  };
};

export interface MorphoVaultHistoryItem {
  type: TransactionTypeEnum;
  assets: bigint;
  blockTimestamp: Date;
  transactionHash: string;
  module: ModuleEnum;
  chainId: number;
  token: Token;
}
