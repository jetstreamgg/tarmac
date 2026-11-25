import { useBytecode } from 'wagmi';
import { codeKind, type CodeLookup } from '../model/recipient';

/**
 * Whether `address` has code on `chainId`: undefined while unknown, including
 * a chain the config can't read; `isChecking` while the first read is in flight.
 */
export function useAddressCode({
  address,
  chainId
}: {
  address: string | undefined;
  chainId: number | undefined;
}): { code: CodeLookup; isChecking: boolean } {
  const { data, isLoading } = useBytecode({
    address: address as `0x${string}` | undefined,
    chainId,
    query: { enabled: !!address && chainId !== undefined, staleTime: 5 * 60_000 }
  });
  return { code: data === undefined ? undefined : codeKind(data), isChecking: isLoading };
}
