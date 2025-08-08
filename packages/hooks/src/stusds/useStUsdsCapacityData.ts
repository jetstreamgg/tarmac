import { useMemo } from 'react';
import { useStUsdsData } from './useStUsdsData';
import { ReadHook } from '../hooks';

export type StUsdsCapacityData = {
  currentCapacity: bigint; // Current vault size
  maxCapacity: bigint; // Maximum capacity (cap)
  utilizationRate: number; // Capacity utilization %
  remainingCapacity: bigint; // Available capacity
};

export type StUsdsCapacityDataHook = ReadHook & {
  data?: StUsdsCapacityData;
};

export function useStUsdsCapacityData(): StUsdsCapacityDataHook {
  const { data: stUsdsData, isLoading, error, mutate } = useStUsdsData();

  const data = useMemo<StUsdsCapacityData | undefined>(() => {
    if (!stUsdsData) return undefined;

    const currentCapacity = stUsdsData.totalAssets;
    const maxCapacity = stUsdsData.cap;

    // Calculate utilization rate as percentage
    const utilizationRate =
      maxCapacity > 0n
        ? Number((currentCapacity * 10000n) / maxCapacity) / 100 // Convert to percentage with 2 decimal places
        : 0;

    // Calculate remaining capacity
    const remainingCapacity = maxCapacity > currentCapacity ? maxCapacity - currentCapacity : 0n;

    return {
      currentCapacity,
      maxCapacity,
      utilizationRate,
      remainingCapacity
    };
  }, [stUsdsData]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: []
  };
}
