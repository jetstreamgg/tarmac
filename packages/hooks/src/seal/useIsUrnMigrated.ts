import { useMemo } from 'react';
import { ReadHook } from '../hooks';
import { SealMigration } from './sealModule';
import { useSealMigrations } from './useSealMigrations';
import { checkUrnMigrationStatus } from './checkUrnMigrationStatus';

export function useIsUrnMigrated({
  owner,
  oldUrnIndex,
  subgraphUrl
}: {
  owner: `0x${string}`;
  oldUrnIndex: number;
  subgraphUrl?: string;
}): ReadHook & { isMigrated: boolean; migrationDetails: SealMigration | undefined } {
  const {
    data: migrations,
    isLoading,
    error,
    mutate,
    dataSources
  } = useSealMigrations({ owner, subgraphUrl });

  const { isMigrated, migrationDetails } = useMemo(
    () => checkUrnMigrationStatus(migrations, oldUrnIndex),
    [migrations, oldUrnIndex]
  );

  return {
    isLoading,
    isMigrated,
    migrationDetails,
    error,
    mutate,
    dataSources
  };
}
