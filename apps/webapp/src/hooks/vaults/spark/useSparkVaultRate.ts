import { useReadContract, useChainId } from 'wagmi';
import { chainId, isTestnetId, formatStrAsApy } from '@/utils';
import { sparkVaultAbi } from '@/hooks/abis/sparkVaultAbi';

// `vsr` is the Vault Savings Rate: a per-second rate in RAY (1e27 = 0% APY), the same accumulator
// pattern the Sky Savings Rate uses — so the APY is derivable on-chain with no off-chain API.

/**
 * Reads the Spark vault's on-chain Vault Savings Rate (`vsr`) and converts it to an APY string,
 * mirroring how the Sky Savings Rate is read for sUSDS. No Spark API required.
 *
 * `formattedRate` is `undefined` until the read resolves, and `"0.00%"` while the rate isn't
 * activated yet (`vsr == 1e27`).
 */
export function useSparkVaultRate({ vaultAddress }: { vaultAddress?: `0x${string}` }) {
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;

  const { data: vsr, isLoading } = useReadContract({
    address: vaultAddress,
    abi: sparkVaultAbi,
    functionName: 'vsr',
    chainId: chainIdToUse,
    query: { enabled: !!vaultAddress }
  });

  return {
    vsr,
    formattedRate: vsr !== undefined ? formatStrAsApy(vsr) : undefined,
    isLoading
  };
}
