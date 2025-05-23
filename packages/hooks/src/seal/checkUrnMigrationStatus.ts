import { SealMigration } from './sealModule';

export function checkUrnMigrationStatus(
  migrations: SealMigration[] | undefined | null,
  oldUrnIndex: number
): { isMigrated: boolean; migrationDetails: SealMigration | undefined } {
  if (!migrations || migrations.length === 0) {
    return { isMigrated: false, migrationDetails: undefined };
  }
  const migration = migrations.find(m => m.oldIndex === oldUrnIndex.toString());
  return {
    isMigrated: !!migration,
    migrationDetails: migration
  };
}
