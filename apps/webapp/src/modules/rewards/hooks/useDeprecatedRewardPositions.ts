import { useMemo } from 'react';
import { useChainId, useConnection, useReadContracts } from 'wagmi';
import {
  isDeprecatedRewardContract,
  useAvailableTokenRewardContracts,
  useMultipleRewardsChartInfo,
  usdsSkyRewardAbi,
  ZERO_ADDRESS,
  type RewardContract
} from '@/hooks';
import { familyMainnetId } from '@/utils';
import { useGeoConfig } from '@/modules/geo-config';

export type DeprecatedRewardPosition = {
  contract: RewardContract;
  balance: bigint;
  /** Farm TVL in USDS from its BA Labs series (latest `totalSupplied`); undefined until it resolves. */
  tvlUsds?: number;
};

/**
 * Deprecated (ended) reward farms the connected user still has USDS supplied
 * to. The marketplace drops deprecated farms from its rows outright
 * (`filterDeprecatedRewardContracts`), so — like matured Pendle PT — an
 * existing position in one has no Earn surface of its own: the farm's detail
 * page still renders by URL (withdraw/claim only), but nothing leads there.
 * The Earn page's "Requires action" section lists these beside the matured
 * markets. Pure read: withdrawing happens on the farm's page.
 *
 * Geo: empty while the `rewards` module is region-restricted — restricted
 * positions hide app-wide (APP-484), with the same in-flight tradeoff as
 * `usePendleMaturedPositions` (positions pass while the config loads, since
 * the loading default is restrictive and would blank them for everyone).
 */
export function useDeprecatedRewardPositions(): {
  positions: DeprecatedRewardPosition[];
  /** Balances still resolving — ended positions unknown, not absent. */
  isLoading: boolean;
} {
  const { address } = useConnection();
  const chainId = familyMainnetId(useChainId());
  const { isModuleEnabled, isLoading: isGeoLoading } = useGeoConfig();
  const rewardsAvailable = isGeoLoading || isModuleEnabled('rewards');

  const allContracts = useAvailableTokenRewardContracts(chainId);
  const deprecatedContracts = useMemo(
    () => allContracts.filter(contract => isDeprecatedRewardContract(contract.contractAddress, chainId)),
    [allContracts, chainId]
  );

  const {
    data: balances,
    isLoading,
    error
  } = useReadContracts({
    contracts: deprecatedContracts.map(contract => ({
      address: contract.contractAddress as `0x${string}`,
      abi: usdsSkyRewardAbi,
      chainId,
      functionName: 'balanceOf' as const,
      args: [address ?? ZERO_ADDRESS]
    })),
    // Region-restricted: don't issue a read whose result is discarded below.
    query: { enabled: rewardsAvailable && !!address && deprecatedContracts.length > 0 }
  });

  const held = useMemo(() => {
    if (!rewardsAvailable || !address || !balances) return [];
    return deprecatedContracts.flatMap((contract, index) => {
      const balance = balances[index]?.result as bigint | undefined;
      return balance !== undefined && balance > 0n ? [{ contract, balance }] : [];
    });
  }, [rewardsAvailable, address, balances, deprecatedContracts]);

  // TVL for the held farms only — the same BA Labs series the marketplace
  // rows and the farm page read; an array-taking hook, so the call count
  // stays fixed. An ended farm still has a TVL (the USDS left in it).
  const { data: charts } = useMultipleRewardsChartInfo({
    rewardContractAddresses: held.map(({ contract }) => contract.contractAddress)
  });

  const positions = useMemo<DeprecatedRewardPosition[]>(
    () =>
      held.map((position, index) => {
        const latest = charts?.[index]?.[0];
        const tvl = latest ? parseFloat(latest.totalSupplied) : NaN;
        return Number.isFinite(tvl) ? { ...position, tvlUsds: tvl } : position;
      }),
    [held, charts]
  );

  return {
    positions,
    isLoading:
      rewardsAvailable &&
      !!address &&
      deprecatedContracts.length > 0 &&
      !error &&
      (isLoading || balances === undefined)
  };
}
