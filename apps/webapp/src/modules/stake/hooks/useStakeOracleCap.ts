import { stringToHex } from 'viem';
import { useChainId, useReadContract } from 'wagmi';
import { getIlkName } from '@/hooks';
import { useReadMcdSpotIlks } from '@/hooks/generated';

const cappedOracleAbi = [
  { type: 'function', name: 'cap', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
] as const;

/** Upper bound of the staking ilk's capped oracle (WAD), read from the pip the Spotter uses. */
export function useStakeOracleCap(): { data?: bigint; isLoading: boolean } {
  const chainId = useChainId();
  const ilkName = getIlkName(2);
  const { data: spotIlk, isLoading: spotLoading } = useReadMcdSpotIlks({
    chainId: chainId as any,
    args: [stringToHex(ilkName, { size: 32 })],
    scopeKey: `spot-ilks-${ilkName}`
  });
  const pip = spotIlk?.[0];
  const { data, isLoading } = useReadContract({
    chainId,
    address: pip,
    abi: cappedOracleAbi,
    functionName: 'cap',
    query: { enabled: !!pip }
  });
  return { data, isLoading: spotLoading || isLoading };
}
