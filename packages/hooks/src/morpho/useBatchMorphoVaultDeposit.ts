import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { steakhousePrimeInstantVaultAbi } from '../generated';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { Call, erc20Abi } from 'viem';

/**
 * Hook for depositing assets into a Morpho vault (ERC-4626 compliant) with batch transaction support.
 *
 * The deposit function converts assets to shares and transfers them to the receiver.
 * Per ERC-4626: deposit(uint256 assets, address receiver) returns (uint256 shares)
 *
 * This hook supports batching the approval and deposit into a single transaction when
 * the wallet supports EIP-5792, otherwise executes them sequentially.
 *
 * @param amount - The amount of underlying assets to deposit (in asset decimals, e.g., 6 for USDC)
 * @param vaultAddress - The Morpho vault address to deposit into (required)
 * @param assetAddress - The underlying asset token address (e.g., USDC) for approval (required)
 * @param enabled - Whether the hook is enabled
 * @param shouldUseBatch - Whether to use batch transactions when supported (default: true)
 * @param onMutate - Callback when transaction is initiated
 * @param onStart - Callback when transaction starts
 * @param onSuccess - Callback when transaction is confirmed
 * @param onError - Callback when transaction fails
 */
export function useBatchMorphoVaultDeposit({
  amount,
  vaultAddress,
  assetAddress,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  shouldUseBatch = true
}: BatchWriteHookParams & {
  amount: bigint;
  vaultAddress: `0x${string}`;
  assetAddress: `0x${string}`;
}): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  // Check current allowance for the underlying asset
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: assetAddress,
    owner: connectedAddress,
    spender: vaultAddress
  });

  const hasAllowance = allowance !== undefined && allowance >= amount;

  // Build the approve call for the underlying asset
  const approveCall = getWriteContractCall({
    to: assetAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [vaultAddress, amount]
  });

  // Build the deposit call
  // ERC-4626 deposit signature: deposit(uint256 assets, address receiver)
  // receiver is the connected address - they receive the vault shares
  const depositCall = getWriteContractCall({
    to: vaultAddress,
    abi: steakhousePrimeInstantVaultAbi,
    functionName: 'deposit',
    args: [amount, connectedAddress!]
  });

  // Conditionally include approve call if allowance is insufficient
  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(depositCall);

  const enabled =
    isConnected &&
    !!amount &&
    amount !== 0n &&
    allowance !== undefined &&
    activeTabEnabled &&
    !!connectedAddress &&
    !!vaultAddress &&
    !!assetAddress;

  const transactionFlowResults = useTransactionFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch,
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...transactionFlowResults,
    error: transactionFlowResults.error || allowanceError
  };
}
