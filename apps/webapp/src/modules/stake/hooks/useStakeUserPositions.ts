import { request, gql } from 'graphql-request';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';

/**
 * One row of the My positions tab: the per-urn staked/borrowed state every
 * surface on the tab shares (table rows, summary aggregates, activity filter).
 * Risk and claimable-rewards data stay per-row on-chain reads — this hook only
 * covers what the subgraph answers in a single query.
 */
export type StakeUserPosition = {
  index: number;
  skyLocked: bigint;
  usdsDebt: bigint;
};

type StakeUserPositionsResponse = {
  stakingUrns: { index: number; skyLocked: string; usdsDebt: string }[];
};

/**
 * Inactive (emptied) urn predicate: nothing staked and nothing borrowed. Urns
 * are never deleted on-chain, so emptied ones stay listed behind the
 * "Hide inactive positions" toggle (UX 1194:20000).
 */
export function isInactiveStakePosition(position: { skyLocked: bigint; usdsDebt: bigint }): boolean {
  return position.skyLocked === 0n && position.usdsDebt === 0n;
}

export function parseStakeUserPositions(response: StakeUserPositionsResponse): StakeUserPosition[] {
  return (response.stakingUrns ?? [])
    .map(urn => ({
      index: Number(urn.index),
      skyLocked: BigInt(urn.skyLocked),
      usdsDebt: BigInt(urn.usdsDebt)
    }))
    .sort((a, b) => a.index - b.index);
}

async function fetchStakeUserPositions(
  urlSubgraph: string,
  chainId: number,
  address: string
): Promise<StakeUserPosition[]> {
  const query = gql`
    {
      stakingUrns: StakingUrn(where: { owner: { _ilike: "${address}" }, chainId: { _eq: ${chainId} } }) {
        index
        skyLocked
        usdsDebt
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as StakeUserPositionsResponse;
  return parseStakeUserPositions(response);
}

/**
 * All staking urns of the connected user in one subgraph query — the shared
 * data source for the positions table, the summary card aggregates, and the
 * activity filter options. Same query family as the engine's `useStakePosition`
 * (single-urn) and `useTotalUserStaked`, kept module-local per the F1 seam
 * precedent: presentation-layer data composition without touching engine hooks.
 */
export function useStakeUserPositions() {
  const { address } = useConnection();
  const chainId = useChainId();
  const subgraphUrl = useSubgraphUrl();

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(subgraphUrl && address),
    queryKey: ['stake-user-positions', subgraphUrl, address, chainId],
    queryFn: () => fetchStakeUserPositions(subgraphUrl, chainId, address!)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate
  };
}
