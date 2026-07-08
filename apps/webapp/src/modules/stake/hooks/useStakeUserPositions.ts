import { request, gql } from 'graphql-request';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';

/**
 * One historical liquidation event ("bark") of a staking urn, as indexed by
 * the subgraph's `Bark` entity. Hasura returns all
 * numerics as strings; parsed here to bigint (WAD/RAD amounts) or number
 * (unix-seconds timestamp) following the hook's existing parsing idiom.
 */
export type StakeUrnBark = {
  id: string;
  ilk: string;
  clip: string;
  clipperId: string;
  ink: bigint; // WAD — collateral seized into the auction
  art: bigint; // WAD — raw debt at bark time
  due: bigint; // RAD — chop-inclusive tab handed to the auction
  blockTimestamp: number; // unix seconds
  transactionHash: string;
};

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
  barks: StakeUrnBark[];
  /** Unix seconds of the latest lock/free/draw/wipe on this urn, undefined if none happened. */
  lastMutationTimestamp: number | undefined;
};

type StakeUrnBarkResponse = {
  id: string;
  ilk: string;
  clip: string;
  clipperId: string;
  ink: string;
  art: string;
  due: string;
  blockTimestamp: string;
  transactionHash: string;
};

type StakeUrnMutationEventResponse = { blockTimestamp: string }[] | null;

type StakeUserPositionsResponse = {
  stakingUrns: {
    index: number;
    skyLocked: string;
    usdsDebt: string;
    barks?: StakeUrnBarkResponse[] | null;
    locks?: StakeUrnMutationEventResponse;
    frees?: StakeUrnMutationEventResponse;
    draws?: StakeUrnMutationEventResponse;
    wipes?: StakeUrnMutationEventResponse;
  }[];
};

function parseStakeUrnBarks(barks: StakeUrnBarkResponse[] | null | undefined): StakeUrnBark[] {
  return (barks ?? []).map(bark => ({
    id: bark.id,
    ilk: bark.ilk,
    clip: bark.clip,
    clipperId: bark.clipperId,
    ink: BigInt(bark.ink),
    art: BigInt(bark.art),
    due: BigInt(bark.due),
    blockTimestamp: Number(bark.blockTimestamp),
    transactionHash: bark.transactionHash
  }));
}

/** Latest of the four position-mutating event queries (each already limited to 1, latest-first). */
function parseLastMutationTimestamp(urn: {
  locks?: StakeUrnMutationEventResponse;
  frees?: StakeUrnMutationEventResponse;
  draws?: StakeUrnMutationEventResponse;
  wipes?: StakeUrnMutationEventResponse;
}): number | undefined {
  const timestamps = [urn.locks, urn.frees, urn.draws, urn.wipes]
    .flatMap(events => events ?? [])
    .map(event => Number(event.blockTimestamp));
  return timestamps.length > 0 ? Math.max(...timestamps) : undefined;
}

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
      usdsDebt: BigInt(urn.usdsDebt),
      barks: parseStakeUrnBarks(urn.barks),
      lastMutationTimestamp: parseLastMutationTimestamp(urn)
    }))
    .sort((a, b) => a.index - b.index);
}

/** Bark with the greatest `blockTimestamp`, undefined if the urn was never barked. */
export function lastStakeUrnBark(position: Pick<StakeUserPosition, 'barks'>): StakeUrnBark | undefined {
  return position.barks.reduce<StakeUrnBark | undefined>(
    (latest, bark) => (!latest || bark.blockTimestamp > latest.blockTimestamp ? bark : latest),
    undefined
  );
}

/**
 * Liquidated (historical) display-state predicate for one urn: barked, and
 * nothing has mutated the position since. locks/frees/draws/wipes are the
 * position-mutating events; reward claims and delegate/reward selection
 * deliberately don't clear the state; a recovery withdraw (free) does, after
 * which the row falls back to `isInactiveStakePosition`. Urn opens only
 * happen at creation, always before any bark, so they're not tracked here.
 */
export function isLiquidatedStakePosition(position: StakeUserPosition): boolean {
  const lastBark = lastStakeUrnBark(position);
  if (!lastBark) return false;
  return position.lastMutationTimestamp === undefined || position.lastMutationTimestamp <= lastBark.blockTimestamp;
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
        barks {
          id
          ilk
          clip
          clipperId
          ink
          art
          due
          blockTimestamp
          transactionHash
        }
        locks(order_by: { blockTimestamp: desc }, limit: 1) { blockTimestamp }
        frees(order_by: { blockTimestamp: desc }, limit: 1) { blockTimestamp }
        draws(order_by: { blockTimestamp: desc }, limit: 1) { blockTimestamp }
        wipes(order_by: { blockTimestamp: desc }, limit: 1) { blockTimestamp }
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
