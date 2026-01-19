import { useMemo } from 'react';
import { useReadContracts, useConnection, useChainId } from 'wagmi';
import { steakhousePrimeInstantVaultAbi } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';

/**
 * Data returned by the useMorphoVaultData hook
 */
export type MorphoVaultData = {
  /** Total assets held by the vault */
  totalAssets: bigint;
  /** Total supply of vault shares */
  totalSupply: bigint;
  /** Current exchange rate: assets per share (with share decimals precision) */
  assetPerShare: bigint;
  /** User's vault share balance */
  userShares: bigint;
  /** User's underlying asset value (equivalent to maxWithdraw) */
  userAssets: bigint;
  /** Maximum amount the user can withdraw */
  userMaxWithdraw: bigint;
  /** Maximum shares the user can redeem */
  userMaxRedeem: bigint;
  /** The underlying asset address */
  asset: `0x${string}`;
  /** Vault share token decimals */
  decimals: number;
};

export type MorphoVaultDataHook = ReadHook & {
  data?: MorphoVaultData;
};

/**
 * Hook for fetching Morpho vault data (ERC-4626 compliant).
 *
 * Fetches vault-level data (totalAssets, totalSupply, exchange rate) and
 * user-specific data (shares balance, underlying value, max withdraw/redeem).
 *
 * All contract reads are batched into a single multicall for efficiency.
 *
 * @param vaultAddress - The Morpho vault contract address (required)
 */
export function useMorphoVaultData({ vaultAddress }: { vaultAddress: `0x${string}` }): MorphoVaultDataHook {
  const { address: userAddress } = useConnection();
  const chainId = useChainId();

  const vaultContract = {
    address: vaultAddress,
    abi: steakhousePrimeInstantVaultAbi,
    chainId
  } as const;

  // Batch all contract reads into a single multicall
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      // Vault-level data (indices 0-4)
      { ...vaultContract, functionName: 'totalAssets' },
      { ...vaultContract, functionName: 'totalSupply' },
      { ...vaultContract, functionName: 'asset' },
      { ...vaultContract, functionName: 'decimals' },
      // Query with 10^18, will normalize based on actual decimals
      { ...vaultContract, functionName: 'convertToAssets', args: [10n ** 18n] },
      // User-specific data (indices 5-7)
      { ...vaultContract, functionName: 'balanceOf', args: [userAddress || ZERO_ADDRESS] },
      { ...vaultContract, functionName: 'maxWithdraw', args: [userAddress || ZERO_ADDRESS] },
      { ...vaultContract, functionName: 'maxRedeem', args: [userAddress || ZERO_ADDRESS] }
    ],
    query: {
      enabled: !!vaultAddress
    }
  });

  // Parse the batched results
  const parsedData = useMemo<MorphoVaultData | undefined>(() => {
    if (!data) return undefined;

    const [
      totalAssetsResult,
      totalSupplyResult,
      assetResult,
      decimalsResult,
      assetPerShareResult,
      userSharesResult,
      maxWithdrawResult,
      maxRedeemResult
    ] = data;

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
    const userShares = userSharesResult.status === 'success' ? userSharesResult.result : 0n;
    const userMaxWithdraw = maxWithdrawResult.status === 'success' ? maxWithdrawResult.result : 0n;
    const userMaxRedeem = maxRedeemResult.status === 'success' ? maxRedeemResult.result : 0n;

    return {
      totalAssets,
      totalSupply,
      assetPerShare,
      userShares,
      // userAssets is equivalent to maxWithdraw for the user's full position
      userAssets: userMaxWithdraw,
      userMaxWithdraw,
      userMaxRedeem,
      asset,
      decimals
    };
  }, [data]);

  // Data sources for transparency
  const dataSources: DataSource[] = vaultAddress
    ? [
        {
          title: 'Morpho Vault Contract',
          onChain: true,
          href: getEtherscanLink(chainId, vaultAddress, 'address'),
          trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
        }
      ]
    : [];

  return {
    isLoading,
    data: parsedData,
    error,
    mutate: refetch,
    dataSources
  };
}
