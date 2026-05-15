import { useMemo } from 'react';
import { useStUsdsData } from './useStUsdsData';
import { ReadHook } from '../hooks';
import { calculateCapacityBuffer } from './helpers';

export type StUsdsCapacityData = {
  currentCapacity: bigint; // Current vault size
  maxCapacity: bigint; // Maximum capacity (cap)
  utilizationRate: number; // Capacity utilization %
  remainingCapacity: bigint; // Available capacity
  remainingCapacityBuffered: bigint; // Available capacity with buffer applied
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
    const borrowedAmount = currentCapacity - stUsdsData.availableLiquidity;
    const utilizationRate =
      currentCapacity > 0n
        ? Number((borrowedAmount * 10000n) / currentCapacity) / 100 // Convert to percentage with 2 decimal places
        : 0;

    // Calculate remaining capacity
    const remainingCapacity = maxCapacity > currentCapacity ? maxCapacity - currentCapacity : 0n;

    const capacityBuffer = stUsdsData.moduleRate
      ? calculateCapacityBuffer(currentCapacity, stUsdsData.moduleRate)
      : 0n;

    // Calculate buffered remaining capacity
    const remainingCapacityBuffered =
      remainingCapacity > capacityBuffer ? remainingCapacity - capacityBuffer : 0n;

    return {
      currentCapacity,
      maxCapacity,
      utilizationRate,
      remainingCapacity,
      remainingCapacityBuffered
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
