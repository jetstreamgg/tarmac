import { useMemo } from 'react';
import { useCollateralData } from '../vaults/useCollateralData';
import { getIlkName } from '../vaults/helpers';
import { ReadHook } from '../hooks';

const BORROW_UTILIZATION_SCALE = 10000n;

export type BorrowCapacityData = {
  debtCeiling: bigint; // Maximum debt ceiling
  totalDebt: bigint; // Total USDS borrowed
  borrowCapacity: bigint; // Available capacity (debtCeiling - totalDebt)
  borrowUtilization: number; // Utilization percentage
};

export type BorrowCapacityDataHook = ReadHook & {
  data?: BorrowCapacityData;
};

export function useBorrowCapacityData(): BorrowCapacityDataHook {
  const ilkName = getIlkName(2); // Sky ilk for staking
  const { data: collateralData, isLoading, error, mutate, dataSources } = useCollateralData(ilkName);

  const data = useMemo<BorrowCapacityData | undefined>(() => {
    if (!collateralData) return undefined;

    const debtCeiling = collateralData.debtCeiling ?? 0n;
    const totalDebt = collateralData.totalDaiDebt ?? 0n;

    // Calculate borrow capacity
    const borrowCapacity = debtCeiling - totalDebt;

    // Calculate utilization rate as percentage
    // If capacity is negative, utilization is 100%
    const borrowUtilization =
      debtCeiling === 0n
        ? 0
        : borrowCapacity < 0n
          ? 100
          : Number((totalDebt * BORROW_UTILIZATION_SCALE) / debtCeiling) / 100; // Convert to percentage with 2 decimal places

    return {
      debtCeiling,
      totalDebt,
      borrowCapacity: borrowCapacity < 0n ? 0n : borrowCapacity,
      borrowUtilization
    };
  }, [collateralData]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: dataSources || []
  };
}
