import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { steakhousePrimeInstantVaultAbi } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

/**
 * Hook for withdrawing assets from a Morpho vault (ERC-4626 compliant).
 *
 * The withdraw function burns shares and returns the underlying assets to the receiver.
 * Per ERC-4626: withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)
 *
 * No token approval is required for withdrawals since the user is burning their own
 * vault shares (which they already own) to receive the underlying assets.
 *
 * @param amount - The amount of underlying assets to withdraw (in asset decimals, e.g., 6 for USDC)
 * @param vaultAddress - The Morpho vault address to withdraw from (required)
 * @param enabled - Whether the hook is enabled
 * @param gas - Optional gas limit override
 * @param onMutate - Callback when transaction is initiated
 * @param onStart - Callback when transaction hash is received
 * @param onSuccess - Callback when transaction is confirmed
 * @param onError - Callback when transaction fails
 */
export function useMorphoVaultWithdraw({
  amount,
  vaultAddress,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true
}: WriteHookParams & {
  amount: bigint;
  vaultAddress: `0x${string}`;
}): WriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  const enabled =
    isConnected && !!amount && amount !== 0n && activeTabEnabled && !!connectedAddress && !!vaultAddress;

  return useWriteContractFlow({
    address: vaultAddress,
    abi: steakhousePrimeInstantVaultAbi,
    functionName: 'withdraw',
    // ERC-4626 withdraw signature: withdraw(uint256 assets, address receiver, address owner)
    // receiver: who receives the underlying assets (the user)
    // owner: who owns the shares being burned (the user)
    args: [amount, connectedAddress!, connectedAddress!],
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
