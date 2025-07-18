import { useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { usdsAddress, useReadStUsds, stUsdsAddress } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';

export type StUsdsHookData = {
  // Vault metrics
  totalAssets: bigint; // Total USDS in vault
  totalSupply: bigint; // Total stUSDS supply
  assetPerShare: bigint; // Current conversion rate

  // User balances
  userStUsdsBalance: bigint; // User's stUSDS balance
  userUsdsBalance: bigint; // User's USDS balance
  userMaxDeposit: bigint; // Max USDS user can deposit
  userMaxWithdraw: bigint; // Max USDS user can withdraw

  // Rate metrics
  savingsRate: bigint; // Current savings rate (ysr)
  chi: bigint; // Interest accumulator

  // Capacity limits
  cap: bigint; // Vault capacity limit
  line: bigint; // Debt ceiling limit
};

export type StUsdsHook = ReadHook & {
  data?: StUsdsHookData;
};

export function useStUsdsData(address?: `0x${string}`): StUsdsHook {
  const chainId = useChainId();
  const { address: connectedAddress } = useAccount();
  const acct = address || connectedAddress;

  // Read vault metrics
  const {
    data: totalAssets,
    isLoading: totalAssetsLoading,
    error: totalAssetsError,
    refetch: refetchTotalAssets
  } = useReadStUsds({
    functionName: 'totalAssets',
    chainId: chainId as keyof typeof useReadStUsds
  });

  const {
    data: totalSupply,
    isLoading: totalSupplyLoading,
    error: totalSupplyError,
    refetch: refetchTotalSupply
  } = useReadStUsds({
    functionName: 'totalSupply',
    chainId: chainId as keyof typeof useReadStUsds
  });

  const {
    data: cap,
    isLoading: capLoading,
    error: capError,
    refetch: refetchCap
  } = useReadStUsds({
    functionName: 'cap',
    chainId: chainId as keyof typeof useReadStUsds
  });

  const {
    data: line,
    isLoading: lineLoading,
    error: lineError,
    refetch: refetchLine
  } = useReadStUsds({
    functionName: 'line',
    chainId: chainId as keyof typeof useReadStUsds
  });

  const {
    data: ysr,
    isLoading: ysrLoading,
    error: ysrError,
    refetch: refetchYsr
  } = useReadStUsds({
    functionName: 'ysr',
    chainId: chainId as keyof typeof useReadStUsds
  });

  const {
    data: chi,
    isLoading: chiLoading,
    error: chiError,
    refetch: refetchChi
  } = useReadStUsds({
    functionName: 'chi',
    chainId: chainId as keyof typeof useReadStUsds
  });

  // Read user-specific data
  const {
    data: userStUsdsBalance,
    isLoading: userStUsdsBalanceLoading,
    error: userStUsdsBalanceError,
    refetch: refetchUserStUsdsBalance
  } = useReadStUsds({
    functionName: 'balanceOf',
    args: [acct || '0x0'],
    chainId: chainId as keyof typeof useReadStUsds,
    query: {
      enabled: !!acct
    }
  });

  const {
    data: userMaxDeposit,
    isLoading: userMaxDepositLoading,
    error: userMaxDepositError,
    refetch: refetchUserMaxDeposit
  } = useReadStUsds({
    functionName: 'maxDeposit',
    args: [acct || '0x0'],
    chainId: chainId as keyof typeof useReadStUsds,
    query: {
      enabled: !!acct
    }
  });

  const {
    data: userMaxWithdraw,
    isLoading: userMaxWithdrawLoading,
    error: userMaxWithdrawError,
    refetch: refetchUserMaxWithdraw
  } = useReadStUsds({
    functionName: 'maxWithdraw',
    args: [acct || '0x0'],
    chainId: chainId as keyof typeof useReadStUsds,
    query: {
      enabled: !!acct
    }
  });

  // Get user's USDS balance
  const {
    data: userUsdsBalance,
    isLoading: userUsdsBalanceLoading,
    error: userUsdsBalanceError,
    refetch: refetchUserUsdsBalance
  } = useTokenBalance({
    address: acct,
    chainId: chainId,
    token: usdsAddress[chainId as keyof typeof usdsAddress]
  });

  // Calculate asset per share ratio
  const assetPerShare = useMemo(() => {
    if (!totalAssets || !totalSupply || totalSupply === 0n) return 0n;
    // Calculate with 18 decimal precision: (totalAssets * 1e18) / totalSupply
    return (totalAssets * 10n ** 18n) / totalSupply;
  }, [totalAssets, totalSupply]);

  // Data sources for transparency
  const dataSourcesVault: DataSource = {
    title: 'stUSDS Contract',
    onChain: true,
    href: getEtherscanLink(chainId, stUsdsAddress[chainId as keyof typeof stUsdsAddress], 'address'),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };

  // Loading state
  const isLoading = useMemo(() => {
    return (
      totalAssetsLoading ||
      totalSupplyLoading ||
      capLoading ||
      lineLoading ||
      ysrLoading ||
      chiLoading ||
      userStUsdsBalanceLoading ||
      userMaxDepositLoading ||
      userMaxWithdrawLoading ||
      userUsdsBalanceLoading
    );
  }, [
    totalAssetsLoading,
    totalSupplyLoading,
    capLoading,
    lineLoading,
    ysrLoading,
    chiLoading,
    userStUsdsBalanceLoading,
    userMaxDepositLoading,
    userMaxWithdrawLoading,
    userUsdsBalanceLoading
  ]);

  // Error state
  const error = useMemo(() => {
    return (
      totalAssetsError ||
      totalSupplyError ||
      capError ||
      lineError ||
      ysrError ||
      chiError ||
      userStUsdsBalanceError ||
      userMaxDepositError ||
      userMaxWithdrawError ||
      userUsdsBalanceError
    );
  }, [
    totalAssetsError,
    totalSupplyError,
    capError,
    lineError,
    ysrError,
    chiError,
    userStUsdsBalanceError,
    userMaxDepositError,
    userMaxWithdrawError,
    userUsdsBalanceError
  ]);

  // Refetch function
  const mutate = () => {
    refetchTotalAssets();
    refetchTotalSupply();
    refetchCap();
    refetchLine();
    refetchYsr();
    refetchChi();
    refetchUserStUsdsBalance();
    refetchUserMaxDeposit();
    refetchUserMaxWithdraw();
    refetchUserUsdsBalance();
  };

  // Calculate user's withdrawable USDS amount from stUSDS balance
  const calculatedWithdrawable = useMemo(() => {
    const stUsdsBalance = userStUsdsBalance || 0n;
    if (!stUsdsBalance || stUsdsBalance === 0n) return 0n;

    // If we have valid vault data, calculate withdrawable amount
    if (totalAssets && totalSupply && totalSupply > 0n) {
      // Calculate: (userStUsdsBalance * totalAssets) / totalSupply
      const calculated = (stUsdsBalance * totalAssets) / totalSupply;

      // Add a small buffer (1 wei) to account for precision issues in ERC-4626 calculations
      // This prevents "insufficient funds" errors when trying to withdraw the exact deposited amount
      return calculated > 0n ? calculated + 1n : calculated;
    }

    // Fallback: assume 1:1 ratio if vault data is not available
    return stUsdsBalance;
  }, [userStUsdsBalance, totalAssets, totalSupply]);

  // Aggregate data - always return an object with at least the USDS balance
  const data = useMemo<StUsdsHookData | undefined>(() => {
    // Use the calculated withdrawable amount if userMaxWithdraw is 0 or undefined
    // Add a small buffer (1 wei) to userMaxWithdraw to account for precision issues
    const rawWithdrawable =
      userMaxWithdraw && userMaxWithdraw > 0n ? userMaxWithdraw : calculatedWithdrawable;
    const withdrawableAmount = rawWithdrawable > 0n ? rawWithdrawable + 1n : rawWithdrawable;

    // Always return basic data structure with USDS balance, even if contract calls fail
    return {
      totalAssets: totalAssets || 0n,
      totalSupply: totalSupply || 0n,
      assetPerShare,
      userStUsdsBalance: userStUsdsBalance || 0n,
      userUsdsBalance: userUsdsBalance?.value || 0n,
      userMaxDeposit: userMaxDeposit || 0n,
      userMaxWithdraw: withdrawableAmount,
      savingsRate: ysr || 0n,
      chi: chi || 0n,
      cap: cap || 0n,
      line: line || 0n
    };
  }, [
    totalAssets,
    totalSupply,
    assetPerShare,
    userStUsdsBalance,
    userUsdsBalance,
    userMaxDeposit,
    userMaxWithdraw,
    calculatedWithdrawable,
    ysr,
    chi,
    cap,
    line
  ]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: [dataSourcesVault]
  };
}
