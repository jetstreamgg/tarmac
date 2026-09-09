import { useMemo } from 'react';
import { stringToHex } from 'viem';
import { useChainId, useConnection, useReadContracts } from 'wagmi';
import { getIlkName, mcdVatAbi, mcdVatAddress, useAllStakeUrnAddresses, useCurrentUrnIndex } from '@/hooks';
import { math } from '@/utils';

/** Live Vat state of one staking urn, keyed by its owner-scoped index. */
export type StakeUrnVault = {
  index: number;
  urnAddress: `0x${string}`;
  /** Vat `ink` — SKY collateral, WAD. */
  skyLocked: bigint;
  /** Vat `art × ilk.rate` — USDS debt, WAD. */
  usdsDebt: bigint;
};

export type StakeUrnVaultsResult = {
  /** One entry per urn the engine reports for the user, ascending by index. Undefined until every read has landed. */
  data: StakeUrnVault[] | undefined;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
};

/**
 * Staked/borrowed amounts of every urn the connected user owns, straight from
 * the chain: engine `ownerUrnsCount` → `ownerUrns(i)` → Vat `urns(ilk, urn)`
 * (+ one `ilks(ilk)` for the rate), batched by wagmi's multicall.
 *
 * This is the live-value source for the positions surfaces. The indexer's
 * `StakingUrn.skyLocked/usdsDebt` are event-derived tallies and can be wrong
 * (Sep 2026: locks misattributed to a phantom zero-address urn hid live
 * positions), so amounts are never read from it — see `useStakeUserPositions`.
 */
export function useStakeUrnVaults(): StakeUrnVaultsResult {
  const chainId = useChainId();
  const { address } = useConnection();
  const ilkHex = stringToHex(getIlkName(2), { size: 32 });
  const vatAddress = mcdVatAddress[chainId as keyof typeof mcdVatAddress];

  const {
    data: urnCount,
    isLoading: countLoading,
    error: countError,
    mutate: refetchCount
  } = useCurrentUrnIndex();
  const {
    data: urnAddresses,
    isLoading: addressesLoading,
    error: addressesError,
    mutate: refetchAddresses
  } = useAllStakeUrnAddresses(address);

  const expectedCount = urnCount === undefined ? undefined : Number(urnCount);
  // `useAllStakeUrnAddresses` drops failed reads, so only trust the list once
  // it has an address for every index the engine reported.
  const addressesReady = expectedCount !== undefined && urnAddresses.length === expectedCount;

  const contracts = useMemo(() => {
    if (!addressesReady || !vatAddress || expectedCount === 0) return [];
    return [
      {
        chainId,
        address: vatAddress,
        abi: mcdVatAbi,
        functionName: 'ilks' as const,
        args: [ilkHex] as const
      },
      ...urnAddresses.map(urn => ({
        chainId,
        address: vatAddress,
        abi: mcdVatAbi,
        functionName: 'urns' as const,
        args: [ilkHex, urn] as const
      }))
    ];
  }, [addressesReady, expectedCount, vatAddress, chainId, ilkHex, urnAddresses]);

  const {
    data: vatResults,
    isLoading: vatLoading,
    error: vatError,
    refetch: refetchVat
  } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0 }
  });

  const data = useMemo<StakeUrnVault[] | undefined>(() => {
    if (!addressesReady) return undefined;
    if (expectedCount === 0) return [];
    if (!vatResults) return undefined;
    const [ilkResult, ...urnResults] = vatResults;
    if (ilkResult.status !== 'success' || urnResults.some(result => result.status !== 'success')) {
      return undefined;
    }
    const [, rate] = ilkResult.result as readonly [bigint, bigint, bigint, bigint, bigint];
    return urnResults.map((result, index) => {
      const [ink, art] = result.result as readonly [bigint, bigint];
      return {
        index,
        urnAddress: urnAddresses[index],
        skyLocked: ink,
        usdsDebt: math.debtValue(art, rate)
      };
    });
  }, [addressesReady, expectedCount, vatResults, urnAddresses]);

  const failedRead =
    vatResults && data === undefined && addressesReady && expectedCount !== 0
      ? new Error('Vat read failed for a staking urn')
      : null;

  return {
    data,
    isLoading: !data && (countLoading || addressesLoading || vatLoading),
    error: (countError as Error | null) ?? (addressesError as Error | null) ?? vatError ?? failedRead,
    mutate: () => {
      refetchCount();
      refetchAddresses();
      refetchVat();
    }
  };
}
