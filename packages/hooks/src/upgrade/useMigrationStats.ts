import { useQuery } from '@tanstack/react-query';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { ReadHook, DataSource } from '../hooks';
import { TRUST_LEVELS } from '../constants';

interface MigrationData {
  date: string;
  migrated: string;
  migrated_change: string;
  migrated_change_percentage: string;
  migration_v1_mkr: string;
  migration_v1_mkr_change: string;
  migration_v1_sky: string;
  migration_v1_sky_change: string;
  migration_v2_mkr: string;
  migration_v2_mkr_change: string;
  migration_v2_sky: string;
  migration_v2_sky_change: string;
  mkr_total_supply: string;
  mkr_total_supply_change: string;
  penalty: number;
  percentage: string;
  percentage_change: string;
  percentage_change_percentage: string;
  sky_total_supply: string;
  sky_total_supply_change: string;
  total: string;
  total_change: string;
  total_change_percentage: string;
}

export function useMigrationStats(chainId: number): ReadHook & { data?: MigrationData } {
  const baseUrl = getBaLabsApiUrl(chainId);

  const result = useQuery<MigrationData>({
    queryKey: ['migrationStats', chainId],
    queryFn: async () => {
      if (!baseUrl) {
        throw new Error('Unable to get API URL for chain');
      }
      const response = await fetch(`${baseUrl.replace('/api/v1', '')}/migrations/migration/?days_ago=1`);
      if (!response.ok) {
        throw new Error('Failed to fetch migration stats');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!baseUrl
  });

  const dataSources: DataSource[] = [
    {
      href: 'https://info-sky.blockanalitica.com',
      title: 'BA Labs API',
      onChain: false,
      trustLevel: TRUST_LEVELS[1]
    }
  ];

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: () => result.refetch(),
    dataSources
  };
}
