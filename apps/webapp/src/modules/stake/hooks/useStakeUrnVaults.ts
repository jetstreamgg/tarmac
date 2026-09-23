import { useQuery } from '@tanstack/react-query';
import { readContract, readContracts, type Config } from '@wagmi/core';
import { stringToHex } from 'viem';
import { useChainId, useConfig, useConnection } from 'wagmi';
import { getIlkName, mcdVatAbi, mcdVatAddress, stakeModuleAbi, stakeModuleAddress } from '@/hooks';
import { mcdSpotAbi, mcdSpotAddress } from '@/hooks/generated';
import { math } from '@/utils';

/** Live Vat state of one staking urn, keyed by its owner-scoped index. */
export type StakeUrnVault = {
  index: number;
  urnAddress: `0x${string}`;
  /** Vat `ink` — SKY collateral, WAD. */
  skyLocked: bigint;
  /** Vat `art` — normalised debt, WAD; `useStakeRowVault` recomputes the risk figures from it. */
  art: bigint;
  /** Vat `art × ilk.rate` — USDS debt, WAD. */
  usdsDebt: bigint;
};

/** Ilk-wide Vat/Spot parameters read in the same pass as the urns, so per-row risk needs no further round trip. */
export type StakeIlkParams = {
  spot: bigint;
  rate: bigint;
  dust: bigint;
  par: bigint;
  mat: bigint;
};

export type StakeUrnVaultsSnapshot = {
  urns: StakeUrnVault[];
  ilk: StakeIlkParams | undefined;
};

export type StakeUrnVaultsResult = {
  /** One entry per urn the engine reports for the user, ascending by index. Undefined until the first read lands. */
  data: StakeUrnVault[] | undefined;
  /** Ilk parameters from the same snapshot; undefined until the first read lands or when the user has no urn. */
  ilk: StakeIlkParams | undefined;
  /** First load only — a refetch keeps the previous list on screen. */
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  mutate: () => void;
};

/** Query-key prefix; `invalidateStakeQueries` refetches it after every stake tx. */
export const STAKE_URN_VAULTS_KEY = 'stake-urn-vaults';

/**
 * Engine `ownerUrnsCount` → `ownerUrns(i)` → Vat `ilks` + `urns(ilk, urn)`,
 * read in sequence so the whole snapshot comes from one pass (the batches are
 * multicalls with `allowFailure: false`, so any failed leg rejects the query
 * instead of silently dropping an urn).
 */
export async function readStakeUrnVaults(
  config: Config,
  chainId: number,
  address: `0x${string}`
): Promise<StakeUrnVaultsSnapshot> {
  const engineAddress = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];
  const vatAddress = mcdVatAddress[chainId as keyof typeof mcdVatAddress];
  const spotAddress = mcdSpotAddress[chainId as keyof typeof mcdSpotAddress];
  if (!engineAddress || !vatAddress || !spotAddress) return { urns: [], ilk: undefined };
  const ilkHex = stringToHex(getIlkName(2), { size: 32 });

  const count = Number(
    await readContract(config, {
      chainId,
      address: engineAddress,
      abi: stakeModuleAbi,
      functionName: 'ownerUrnsCount',
      args: [address]
    })
  );
  if (count === 0) return { urns: [], ilk: undefined };

  const urnAddresses = await readContracts(config, {
    allowFailure: false,
    contracts: Array.from({ length: count }, (_, index) => ({
      chainId,
      address: engineAddress,
      abi: stakeModuleAbi,
      functionName: 'ownerUrns' as const,
      args: [address, BigInt(index)] as const
    }))
  });

  const [[ilk, par, spotIlk], urns] = await Promise.all([
    readContracts(config, {
      allowFailure: false,
      contracts: [
        {
          chainId,
          address: vatAddress,
          abi: mcdVatAbi,
          functionName: 'ilks' as const,
          args: [ilkHex] as const
        },
        { chainId, address: spotAddress, abi: mcdSpotAbi, functionName: 'par' as const },
        {
          chainId,
          address: spotAddress,
          abi: mcdSpotAbi,
          functionName: 'ilks' as const,
          args: [ilkHex] as const
        }
      ]
    }),
    readContracts(config, {
      allowFailure: false,
      contracts: urnAddresses.map(urn => ({
        chainId,
        address: vatAddress,
        abi: mcdVatAbi,
        functionName: 'urns' as const,
        args: [ilkHex, urn] as const
      }))
    })
  ]);
  const [, rate, spot, , dust] = ilk;
  const [, mat] = spotIlk;

  return {
    urns: urns.map((urn, index) => {
      const [ink, art] = urn;
      return {
        index,
        urnAddress: urnAddresses[index],
        skyLocked: ink,
        art,
        usdsDebt: math.debtValue(art, rate)
      };
    }),
    ilk: { spot, rate, dust, par, mat }
  };
}

/**
 * Staked/borrowed amounts of every urn the connected user owns, straight from
 * the chain. This is the live-value source for the positions surfaces: the
 * indexer's `StakingUrn.skyLocked/usdsDebt` are event-derived tallies and can
 * be wrong (Sep 2026: locks misattributed to a phantom zero-address urn hid
 * live positions), so amounts are never read from it.
 *
 * One react-query entry keyed by chain + address: a post-tx invalidation
 * refetches it in place (the previous list stays on screen, no skeleton
 * collapse), and a freshly opened urn shows up as soon as `ownerUrnsCount`
 * reports it — `invalidateStakeQueries` re-fires along its lag trail in case
 * the first refetch is answered by a node still a block behind the receipt.
 */
export function useStakeUrnVaults(): StakeUrnVaultsResult {
  const config = useConfig();
  const chainId = useChainId();
  const { address } = useConnection();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    enabled: Boolean(address),
    queryKey: [STAKE_URN_VAULTS_KEY, chainId, address],
    queryFn: () => readStakeUrnVaults(config, chainId, address!)
  });

  return {
    data: data?.urns,
    ilk: data?.ilk,
    isLoading,
    isFetching,
    error: (error as Error | null) ?? null,
    mutate: () => {
      refetch();
    }
  };
}
