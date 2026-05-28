import { OracleData, OraclesHookResponse } from './oracles';
import { oraclesMockData } from './constants';
import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';

async function fetchOracles(): Promise<OracleData[]> {
  // TODO fetch actual data
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(Object.values(oraclesMockData));
    }, 100); // Simulate call to oracle
  });
}

export function useOracles(): OraclesHookResponse {
  const chainId = useChainId();

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: true,
    queryKey: ['oracle-prices', chainId],
    queryFn: () => fetchOracles()
  });

  return { data, isLoading, error, mutate, dataSources: [] };
}
