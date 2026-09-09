import { useCallback, useMemo } from 'react';
import { request, gql } from 'graphql-request';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { useIndexerUrl } from '@/modules/app/hooks/useIndexerUrl';
import { StakeUrnVault, useStakeUrnVaults } from './useStakeUrnVaults';

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
 * `skyLocked`/`usdsDebt` are live Vat reads (`useStakeUrnVaults`); the subgraph
 * contributes only the event-derived context (barks, latest mutation). Risk and
 * claimable-rewards data stay per-row on-chain reads.
 */
export type StakeUserPosition = {
  index: number;
  /** Engine `ownerUrns(index)` — resolved once by `useStakeUrnVaults`, shared by every per-row read. */
  urnAddress: `0x${string}`;
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

/** The subgraph's contribution to a row: everything but the live amounts and the urn address. */
export type StakeSubgraphPosition = Omit<StakeUserPosition, 'urnAddress'>;

export function parseStakeUserPositions(response: StakeUserPositionsResponse): StakeSubgraphPosition[] {
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
  return (
    position.lastMutationTimestamp === undefined || position.lastMutationTimestamp <= lastBark.blockTimestamp
  );
}

/**
 * Live Vat amounts joined with the subgraph's event context, one row per urn
 * the engine reports. The chain decides which urns exist and what they hold;
 * a subgraph row with no on-chain counterpart is dropped, and an on-chain urn
 * the subgraph hasn't (correctly) indexed still renders — with no barks and no
 * mutation timestamp. That is exactly the Sep 2026 failure: the indexer
 * credited fresh locks to a phantom zero-address urn, so `skyLocked` stayed 0
 * and live positions were classified inactive and hidden.
 */
export function mergeStakeUserPositions(
  vaults: StakeUrnVault[],
  subgraphPositions: StakeSubgraphPosition[] | undefined
): StakeUserPosition[] {
  const byIndex = new Map((subgraphPositions ?? []).map(position => [position.index, position]));
  return vaults
    .map(vault => {
      const indexed = byIndex.get(vault.index);
      return {
        index: vault.index,
        urnAddress: vault.urnAddress,
        skyLocked: vault.skyLocked,
        usdsDebt: vault.usdsDebt,
        barks: indexed?.barks ?? [],
        lastMutationTimestamp: indexed?.lastMutationTimestamp
      };
    })
    .sort((a, b) => a.index - b.index);
}

async function fetchStakeUserPositions(
  urlIndexer: string,
  chainId: number,
  address: string
): Promise<StakeSubgraphPosition[]> {
  const query = gql`
    {
      stakingUrns: StakingUrn(where: { owner: { _eq: "${address.toLowerCase()}" }, chainId: { _eq: ${chainId} } }) {
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

  const response = (await request(urlIndexer, query)) as StakeUserPositionsResponse;
  return parseStakeUserPositions(response);
}

/**
 * All staking urns of the connected user: amounts from the chain, event
 * context from the subgraph, joined per urn index (`mergeStakeUserPositions`).
 * The chain is authoritative — a chain read failure is surfaced as `error`
 * with no rows (never the indexer's tallies, which are what this hook exists
 * to distrust). The subgraph decides liquidation state through barks, so the
 * rows wait for it to settle too; if it fails, the rows still render from the
 * chain and `contextError` tells the surfaces the bark context is missing.
 */
export function useStakeUserPositions() {
  const { address } = useConnection();
  const chainId = useChainId();
  const indexerUrl = useIndexerUrl();

  const vaults = useStakeUrnVaults();

  const {
    data: subgraphPositions,
    error: subgraphError,
    refetch: refetchSubgraph,
    isLoading: subgraphLoading
  } = useQuery({
    enabled: Boolean(indexerUrl && address),
    queryKey: ['stake-user-positions', indexerUrl, address, chainId],
    queryFn: () => fetchStakeUserPositions(indexerUrl, chainId, address!)
  });

  const subgraphSettled = subgraphPositions !== undefined || Boolean(subgraphError);
  const data = useMemo(
    () =>
      vaults.data && !vaults.error && subgraphSettled
        ? mergeStakeUserPositions(vaults.data, subgraphPositions)
        : undefined,
    [vaults.data, vaults.error, subgraphSettled, subgraphPositions]
  );

  const mutate = useCallback(() => {
    vaults.mutate();
    refetchSubgraph();
  }, [vaults, refetchSubgraph]);

  return {
    data,
    isLoading: !data && !vaults.error && (vaults.isLoading || subgraphLoading),
    error: vaults.error,
    /** Subgraph failure: rows are live but carry no barks/timestamps, so liquidation state is unknown. */
    contextError: (subgraphError as Error | null) ?? null,
    mutate
  };
}
