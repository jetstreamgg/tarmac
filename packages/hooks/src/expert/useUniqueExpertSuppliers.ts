import { useMemo } from 'react';
import { useStUsdsSupplierAddresses } from '../stusds/useStUsdsSupplierAddresses';
import { useMorphoVaultSupplierAddresses } from '../morpho/useMorphoVaultSupplierAddresses';
import { ReadHook, DataSource } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';

export type UniqueExpertSuppliersData = {
  /** Total unique suppliers across all expert modules (deduplicated) */
  uniqueCount: number;
  /** Number of stUSDS suppliers */
  stUsdsCount: number;
  /** Number of Morpho vault suppliers */
  morphoCount: number;
  /** All unique addresses (lowercase) */
  addresses: string[];
};

export type UniqueExpertSuppliersHook = ReadHook & {
  data?: UniqueExpertSuppliersData;
};

export function useUniqueExpertSuppliers(): UniqueExpertSuppliersHook {
  const {
    data: stUsdsAddresses,
    isLoading: stUsdsLoading,
    error: stUsdsError,
    dataSources: stUsdsDataSources,
    mutate: mutateStUsds
  } = useStUsdsSupplierAddresses();

  const {
    data: morphoAddresses,
    isLoading: morphoLoading,
    error: morphoError,
    dataSources: morphoDataSources,
    mutate: mutateMorpho
  } = useMorphoVaultSupplierAddresses();

  const isLoading = stUsdsLoading || morphoLoading;
  const error = stUsdsError || morphoError;

  const data = useMemo(() => {
    if (!stUsdsAddresses && !morphoAddresses) {
      return undefined;
    }

    const stUsds = stUsdsAddresses || [];
    const morpho = morphoAddresses || [];

    // Combine and deduplicate (addresses are already lowercase)
    const allAddresses = new Set([...stUsds, ...morpho]);

    return {
      uniqueCount: allAddresses.size,
      stUsdsCount: stUsds.length,
      morphoCount: morpho.length,
      addresses: Array.from(allAddresses)
    };
  }, [stUsdsAddresses, morphoAddresses]);

  const dataSources: DataSource[] = useMemo(
    () => [
      ...(stUsdsDataSources || []),
      ...(morphoDataSources || []),
      {
        title: 'Deduplicated',
        href: '',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ],
    [stUsdsDataSources, morphoDataSources]
  );

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate: async () => {
      await Promise.all([mutateStUsds(), mutateMorpho()]);
    },
    dataSources
  };
}
