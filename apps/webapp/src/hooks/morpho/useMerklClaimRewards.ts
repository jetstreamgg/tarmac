import { useChainId, useConnection } from 'wagmi';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { morphoMerklDistributorAddress, morphoMerklDistributorImplementationAbi } from '../generated';
import { WriteHook, WriteHookParams } from '../hooks';
import { MerklTokenReward } from './useMerklRewards';

/**
 * Hook for claiming selected Merkl rewards from the distributor.
 *
 * Accepts an array of selected MerklTokenReward objects (one per token the user
 * wants to claim). The Merkl contract always claims the full cumulative amount
 * per token, so the claim will include rewards from all sources (vaults + other
 * campaigns) for each selected token.
 */
export function useMerklClaimRewards({
  rewards,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true
}: WriteHookParams & {
  rewards: MerklTokenReward[];
}): WriteHook {
  const chainId = useChainId();
  const { address: connectedAddress } = useConnection();

  const claimableRewards = rewards.filter(r => r.totalAmount > r.claimed && r.proofs.length > 0);

  const users = claimableRewards.map(() => connectedAddress!);
  const tokens = claimableRewards.map(r => r.tokenAddress);
  const amounts = claimableRewards.map(r => r.totalAmount);
  const proofs = claimableRewards.map(r => r.proofs as `0x${string}`[]);

  const hasClaimableRewards = claimableRewards.length > 0;
  const enabled = !!connectedAddress && hasClaimableRewards && activeTabEnabled;

  return useWriteContractFlow({
    address: morphoMerklDistributorAddress[chainId as keyof typeof morphoMerklDistributorAddress],
    abi: morphoMerklDistributorImplementationAbi,
    functionName: 'claim',
    args: [users, tokens, amounts, proofs],
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
