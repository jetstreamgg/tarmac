import { useMemo } from 'react';
import { useReadContracts, useConnection, useChainId } from 'wagmi';
import { usdsRiskCapitalVaultAbi } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { VaultProvider } from './types';
import { sharesToAssets } from './sharesToAssets';
import { chainId, getEtherscanLink, isTestnetId } from '@/utils';

/** Human-readable data-source label per provider for the on-chain vault contract. */
const VAULT_CONTRACT_DATA_SOURCE_TITLE: Record<VaultProvider, string> = {
  morpho: 'Morpho Vault Contract',
  sky: 'Sky Vault Contract'
};

/**
 * Data returned by the useErc4626VaultData hook
 */
export type Erc4626VaultData = {
  /** Total assets held by the vault */
  totalAssets: bigint;
  /** Total supply of vault shares */
  totalSupply: bigint;
  /** Current exchange rate: assets per share (with share decimals precision) */
  assetPerShare: bigint;
  /** User's vault share balance */
  userShares: bigint;
  /** User's underlying asset value (calculated via convertToAssets) */
  userAssets: bigint;
  /** On-chain `maxDeposit(user)` — remaining room under the vault's supply cap (undefined when not connected/read). */
  maxDeposit?: bigint;
  /** On-chain `maxWithdraw(user)` — assets the user can withdraw right now (undefined when not connected/read). */
  maxWithdraw?: bigint;
  /** On-chain `maxRedeem(user)` — shares the user can redeem right now (undefined when not connected/read). */
  maxRedeem?: bigint;
  /** The underlying asset address */
  asset: `0x${string}`;
  /** Vault share token decimals */
  decimals: number;
};

export type Erc4626VaultDataHook = ReadHook & {
  data?: Erc4626VaultData;
};

/**
 * Provider-neutral hook for fetching ERC-4626 vault data on-chain.
 *
 * Reads vault-level data (totalAssets, totalSupply, exchange rate) and
 * user-specific data (shares balance, underlying value) using the generic
 * ERC-4626 ABI, so it works against any compliant vault (Morpho, Spark, …).
 *
 * Contract reads are split into two batches:
 * 1. General vault data (always fetched)
 * 2. User-specific data (fetched when user is connected)
 *
 * @param vaultAddress - The vault contract address (required)
 * @param provider - Which provider operates the vault (defaults to `morpho`);
 *   only affects the data-source label shown for transparency.
 */
export function useErc4626VaultData({
  vaultAddress,
  provider = 'morpho'
}: {
  vaultAddress?: `0x${string}`;
  provider?: VaultProvider;
}): Erc4626VaultDataHook {
  const { address: userAddress } = useConnection();
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;

  const vaultContract = {
    address: vaultAddress,
    abi: usdsRiskCapitalVaultAbi,
    chainId: chainIdToUse
  } as const;

  // Batch 1: General vault data
  const {
    data: vaultData,
    isLoading: isVaultLoading,
    error: vaultError,
    refetch: refetchVault
  } = useReadContracts({
    contracts: [
      { ...vaultContract, functionName: 'totalAssets' },
      { ...vaultContract, functionName: 'totalSupply' },
      { ...vaultContract, functionName: 'asset' },
      { ...vaultContract, functionName: 'decimals' },
      // Query with 10^18, will normalize based on actual decimals
      { ...vaultContract, functionName: 'convertToAssets', args: [10n ** 18n] }
    ],
    query: {
      enabled: !!vaultAddress
    }
  });

  // Batch 2: User-specific data (only when user is connected)
  const {
    data: userData,
    isLoading: isUserLoading,
    error: userError,
    refetch: refetchUser
  } = useReadContracts({
    contracts: [
      { ...vaultContract, functionName: 'balanceOf', args: [userAddress || ZERO_ADDRESS] },
      { ...vaultContract, functionName: 'maxDeposit', args: [userAddress || ZERO_ADDRESS] },
      { ...vaultContract, functionName: 'maxWithdraw', args: [userAddress || ZERO_ADDRESS] },
      { ...vaultContract, functionName: 'maxRedeem', args: [userAddress || ZERO_ADDRESS] }
    ],
    query: {
      enabled: !!vaultAddress && !!userAddress
    }
  });

  const isLoading = isVaultLoading || isUserLoading;
  const error = vaultError || userError;
  const refetch = async () => {
    await Promise.all([refetchVault(), refetchUser()]);
  };

  // Parse the batched results
  const parsedData = useMemo<Erc4626VaultData | undefined>(() => {
    if (!vaultData) return undefined;

    const [totalAssetsResult, totalSupplyResult, assetResult, decimalsResult, assetPerShareResult] =
      vaultData;

    // Check that all vault-level data succeeded
    if (
      totalAssetsResult.status !== 'success' ||
      totalSupplyResult.status !== 'success' ||
      assetResult.status !== 'success' ||
      decimalsResult.status !== 'success' ||
      assetPerShareResult.status !== 'success'
    ) {
      return undefined;
    }

    const totalAssets = totalAssetsResult.result;
    const totalSupply = totalSupplyResult.result;
    const asset = assetResult.result;
    const decimals = decimalsResult.result;
    const assetPerShare = assetPerShareResult.result;

    // User data defaults to 0 if not connected or call failed
    const userShares = userData?.[0]?.status === 'success' ? userData[0].result : 0n;

    // On-chain ERC-4626 limits. Left undefined (not 0n) when not connected/read so
    // callers can distinguish "no room" from "unknown" (e.g. a false cap-reached state).
    const maxDeposit = userData?.[1]?.status === 'success' ? userData[1].result : undefined;
    const maxWithdraw = userData?.[2]?.status === 'success' ? userData[2].result : undefined;
    const maxRedeem = userData?.[3]?.status === 'success' ? userData[3].result : undefined;

    // assetPerShare is convertToAssets(10^18); convert via the queried 10^18 scale (NOT the
    // share decimals — those only coincide for 18-decimal vaults; sUSDT shares are 6-decimal).
    const userAssets = sharesToAssets(userShares, assetPerShare);

    return {
      totalAssets,
      totalSupply,
      assetPerShare,
      userShares,
      userAssets,
      maxDeposit,
      maxWithdraw,
      maxRedeem,
      asset,
      decimals
    };
  }, [vaultData, userData]);

  // Data sources for transparency — labelled per provider.
  const dataSources: DataSource[] = vaultAddress
    ? [
        {
          title: VAULT_CONTRACT_DATA_SOURCE_TITLE[provider],
          onChain: true,
          href: getEtherscanLink(chainIdToUse, vaultAddress, 'address'),
          trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
        }
      ]
    : [];

  return {
    isLoading,
    data: parsedData,
    error: error || null,
    mutate: refetch,
    dataSources
  };
}
