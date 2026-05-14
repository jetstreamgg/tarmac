import { OracleData, OracleHookResponse } from './oracles';
import { Token } from '../tokens/types';
import { useQuery } from '@tanstack/react-query';
import { oraclesMockData } from './constants';
import { useChainId } from 'wagmi';

async function fetchOracle(token: Token): Promise<OracleData | undefined> {
  if (!token) return new Promise(resolve => resolve(undefined));

  // TODO fetch actual data
  return new Promise(resolve => {
    setTimeout(() => {
      const oracleData = oraclesMockData[token.symbol.toLowerCase()];
      resolve(oracleData);
    }, 100); // Simulate async call delay
  });
}

export function useOracle(token: Token): OracleHookResponse {
  const chainId = useChainId();

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: !!token,
    queryKey: ['oracle-price', chainId, token?.symbol],
    queryFn: () => fetchOracle(token)
  });

  return { data, isLoading, error, mutate, dataSources: [] };
}
