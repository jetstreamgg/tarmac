import request, { gql } from 'graphql-request';
import { useChainId } from 'wagmi';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { SealMigrationRaw, SealMigration } from './sealModule';

async function fetchSealMigrations(urlSubgraph: string, owner: `0x${string}`) {
  const query = gql`
    {
      lockstakeMigrates(where: { oldOwner: "${owner}" }, orderBy: oldIndex, orderDirection: asc) {
        id
        oldOwner
        newOwner
        oldIndex
        newIndex
        ink
        debt
        blockNumber
        blockTimestamp
        transactionHash
      }
    }
  `;

  const response = await request<{
    lockstakeMigrates: SealMigrationRaw[];
  }>(urlSubgraph, query);
  const parsedSealMigrations = response.lockstakeMigrates;
  if (!parsedSealMigrations) {
    return undefined;
  }

  return parsedSealMigrations.map(migration => ({
    ...migration,
    ink: BigInt(migration.ink || 0),
    debt: BigInt(migration.debt || 0)
  })) as SealMigration[];
}

export function useSealMigrations({
  owner,
  subgraphUrl
}: {
  owner: `0x${string}`;
  subgraphUrl?: string;
}): ReadHook & { data: SealMigration[] | undefined } {
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['sealMigrations', urlSubgraph, owner],
    queryFn: () => fetchSealMigrations(urlSubgraph, owner),
    enabled: !!urlSubgraph && !!owner
  });

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem subgraph',
        href: urlSubgraph,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
