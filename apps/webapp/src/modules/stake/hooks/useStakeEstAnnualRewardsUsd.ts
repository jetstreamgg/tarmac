import { useMemo } from 'react';
import { useChainId, useReadContracts } from 'wagmi';
import {
  stakeModuleAbi,
  stakeModuleAddress,
  useMultipleRewardsChartInfo,
  useSkyPrice,
  useStakeRewardContracts
} from '@/hooks';
import { ZERO_ADDRESS } from '@/hooks/constants';
import { wadToFloat } from '../lib/stakeUsdNotional';
import { StakeUserPosition } from './useStakeUserPositions';

/**
 * Est. annual rewards across urns, in USD: each urn's staked SKY × its own
 * farm's latest rate × SKY price (the per-position modal's formula, summed).
 * Urns with no farm selected earn nothing. Null until rates and price resolve.
 */
export function useStakeEstAnnualRewardsUsd(positions?: StakeUserPosition[]): {
  data: number | null;
  isLoading: boolean;
} {
  const chainId = useChainId();
  const engine = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];

  const { data: farms, isLoading: farmsLoading } = useReadContracts({
    contracts: (positions ?? []).map(position => ({
      chainId,
      address: engine,
      abi: stakeModuleAbi,
      functionName: 'urnFarms' as const,
      args: [position.urnAddress] as const
    })),
    query: { enabled: Boolean(positions?.length) }
  });

  const { data: rewardContracts, isLoading: contractsLoading } = useStakeRewardContracts();
  const contractAddresses = useMemo(
    () => rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    [rewardContracts]
  );
  // Series come back index-aligned with the addresses passed in.
  const { data: chartInfo, isLoading: chartsLoading } = useMultipleRewardsChartInfo({
    rewardContractAddresses: contractAddresses
  });
  const { priceString, isLoading: priceLoading } = useSkyPrice();

  const data = useMemo(() => {
    if (!positions || !farms || !chartInfo || !priceString) return null;
    const skyPrice = parseFloat(priceString);
    const rateByFarm = new Map<string, number>();
    contractAddresses.forEach((address, i) => {
      const latest = [...(chartInfo[i] ?? [])].sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0];
      const rate = latest ? parseFloat(latest.rate) : NaN;
      if (Number.isFinite(rate)) rateByFarm.set(address.toLowerCase(), rate);
    });
    return positions.reduce((total, position, i) => {
      const farm = farms[i]?.result as `0x${string}` | undefined;
      if (!farm || farm === ZERO_ADDRESS) return total;
      return total + wadToFloat(position.skyLocked) * (rateByFarm.get(farm.toLowerCase()) ?? 0) * skyPrice;
    }, 0);
  }, [positions, farms, chartInfo, priceString, contractAddresses]);

  return { data, isLoading: farmsLoading || contractsLoading || chartsLoading || priceLoading };
}
