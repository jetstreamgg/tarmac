import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { usdsRiskCapitalVaultAbi } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

/**
 * Hook for redeeming shares from a Morpho vault (ERC-4626 compliant).
 *
 * The redeem function burns a specific amount of shares and returns the underlying assets.
 * Per ERC-4626: redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)
 *
 * Use this hook instead of withdraw when the user wants to withdraw their full balance
 * to avoid leaving dust in the contract. The widget should use redeem when the user
 * clicks "Max" or withdraws their entire position.
 *
 * No token approval is required for redemptions since the user is burning their own
 * vault shares (which they already own) to receive the underlying assets.
 *
 * @param shares - The amount of vault shares to redeem (in vault share decimals)
 * @param vaultAddress - The Morpho vault address to redeem from (required)
 * @param enabled - Whether the hook is enabled
 * @param gas - Optional gas limit override
 * @param onMutate - Callback when transaction is initiated
 * @param onStart - Callback when transaction hash is received
 * @param onSuccess - Callback when transaction is confirmed
 * @param onError - Callback when transaction fails
 */
export function useMorphoVaultRedeem({
  shares,
  vaultAddress,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true
}: WriteHookParams & {
  shares: bigint;
  vaultAddress: `0x${string}`;
}): WriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  const enabled =
    isConnected && !!shares && shares !== 0n && activeTabEnabled && !!connectedAddress && !!vaultAddress;

  return useWriteContractFlow({
    address: vaultAddress,
    abi: usdsRiskCapitalVaultAbi,
    functionName: 'redeem',
    // ERC-4626 redeem signature: redeem(uint256 shares, address receiver, address owner)
    // shares: the amount of vault shares to burn
    // receiver: who receives the underlying assets (the user)
    // owner: who owns the shares being burned (the user)
    args: [shares, connectedAddress!, connectedAddress!],
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
