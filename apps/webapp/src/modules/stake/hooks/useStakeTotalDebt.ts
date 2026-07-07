import { useMemo } from 'react';
import { useChainId, useReadContracts } from 'wagmi';
import { stringToHex, type ContractFunctionParameters } from 'viem';
import { mcdVatAbi, mcdVatAddress, getIlkName } from '@/hooks';

const RAY = 10n ** 27n;

/**
 * Live debt summation: art × rate per urn, in wad. Pure — tested directly.
 * (Same formula as the engine's `math.debtValue`, applied across urns.)
 */
export function sumUrnDebts(rate: bigint, urnArts: readonly bigint[]): bigint {
  return urnArts.reduce((total, art) => total + (art * rate) / RAY, 0n);
}

/**
 * Aggregate LIVE debt (principal + accrued interest) across the user's staking
 * urns, read from the Vat in one batched call — the same source the legacy
 * widget shows per urn (`vault.debtValue`). The subgraph's `usdsDebt` tracks
 * drawn principal only, which understates what is actually owed.
 */
export function useStakeTotalDebt(urnAddresses?: `0x${string}`[]) {
  const chainId = useChainId();
  const vat = mcdVatAddress[chainId as keyof typeof mcdVatAddress];
  const ilk = stringToHex(getIlkName(2), { size: 32 });
  const urns = urnAddresses ?? [];

  // Heterogeneous batch (one `ilks` + N `urns`): typed as the generic viem
  // parameter list so TS doesn't force every entry into the first call's shape.
  const contracts: (ContractFunctionParameters & { chainId: number })[] = [
    { address: vat, abi: mcdVatAbi, functionName: 'ilks', args: [ilk], chainId },
    ...urns.map(urn => ({
      address: vat,
      abi: mcdVatAbi,
      functionName: 'urns',
      args: [ilk, urn],
      chainId
    }))
  ];

  const { data, isLoading, error } = useReadContracts({
    contracts,
    allowFailure: false,
    query: { enabled: Boolean(vat && urns.length) }
  });

  const totalDebt = useMemo(() => {
    if (!data) return undefined;
    const [ilkData, ...urnData] = data as [
      readonly [bigint, bigint, bigint, bigint, bigint],
      ...(readonly [bigint, bigint])[]
    ];
    const rate = ilkData[1];
    return sumUrnDebts(
      rate,
      urnData.map(([, art]) => art)
    );
  }, [data]);

  return { data: totalDebt, isLoading, error: error as Error | null };
}
