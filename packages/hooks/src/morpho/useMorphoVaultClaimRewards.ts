import { useChainId, useConnection } from 'wagmi';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { morphoMerklDistributorAddress, morphoMerklDistributorImplementationAbi } from '../generated';
import { WriteHook, WriteHookParams } from '../hooks';
import { MorphoVaultReward } from './useMorphoVaultRewards';

/**
 * Hook for claiming Morpho vault rewards from the Merkl distributor.
 *
 * The claim function on the Merkl distributor contract expects:
 * - users: array of recipient addresses (one per token being claimed)
 * - tokens: array of token addresses to claim
 * - amounts: array of cumulative amounts (total earned, not just pending)
 * - proofs: array of merkle proofs for each claim
 *
 * @param rewards - Array of MorphoVaultReward objects from useMorphoVaultRewards hook
 * @param enabled - Whether the hook is enabled
 * @param gas - Optional gas limit override
 * @param onMutate - Callback when transaction is initiated
 * @param onStart - Callback when transaction hash is received
 * @param onSuccess - Callback when transaction is confirmed
 * @param onError - Callback when transaction fails
 */
export function useMorphoVaultClaimRewards({
  rewards,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true
}: WriteHookParams & {
  rewards: MorphoVaultReward[];
}): WriteHook {
  const chainId = useChainId();
  const { address: connectedAddress } = useConnection();

  const claimableRewards = rewards.filter(r => r.amount > 0n && r.proofs.length > 0);

  // Build the arrays required by the claim function
  // Each reward needs: user address, token address, cumulative amount, and proofs
  const users = claimableRewards.map(() => connectedAddress!);
  const tokens = claimableRewards.map(r => r.tokenAddress);
  const amounts = claimableRewards.map(r => r.amount); // Cumulative amount, not pending
  const proofs = claimableRewards.map(r => r.proofs as `0x${string}`[]);

  const hasClaimableRewards = claimableRewards.length > 0;
  const enabled = !!connectedAddress && hasClaimableRewards && activeTabEnabled;

  return useWriteContractFlow({
    address: morphoMerklDistributorAddress[chainId as keyof typeof morphoMerklDistributorAddress],
    abi: morphoMerklDistributorImplementationAbi,
    functionName: 'claim',
    // claim(address[] users, address[] tokens, uint256[] amounts, bytes32[][] proofs)
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
