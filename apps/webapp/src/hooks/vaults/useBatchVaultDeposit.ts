import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { usdtAbi, usdtAddress } from '../generated';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { VaultProvider } from './types';
import { buildVaultDepositCall } from '@/lib/vaults/buildVaultDepositCall';
import { Call, erc20Abi } from 'viem';

/**
 * Hook for depositing assets into an ERC-4626 vault with batch transaction support.
 *
 * The deposit function converts assets to shares and transfers them to the receiver.
 * Per ERC-4626: deposit(uint256 assets, address receiver) returns (uint256 shares)
 *
 * This hook supports batching the approval and deposit into a single transaction when
 * the wallet supports EIP-5792, otherwise executes them sequentially.
 *
 * @param amount - The amount of underlying assets to deposit (in asset decimals, e.g., 6 for USDC)
 * @param vaultAddress - The vault address to deposit into (required)
 * @param assetAddress - The underlying asset token address (e.g., USDC) for approval (required)
 * @param enabled - Whether the hook is enabled
 * @param shouldUseBatch - Whether to use batch transactions when supported (default: true)
 * @param onMutate - Callback when transaction is initiated
 * @param onStart - Callback when transaction starts
 * @param onSuccess - Callback when transaction is confirmed
 * @param onError - Callback when transaction fails
 */
export function useBatchVaultDeposit({
  amount,
  vaultAddress,
  assetAddress,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  shouldUseBatch = true,
  provider = 'morpho',
  referral = 0
}: BatchWriteHookParams & {
  amount: bigint;
  vaultAddress: `0x${string}`;
  assetAddress: `0x${string}`;
  /** Vault provider — only Spark attaches the on-chain referral code. Defaults to Morpho. */
  provider?: VaultProvider;
  /** Referral code to attribute the deposit to; ignored unless provider is Spark. */
  referral?: number;
}): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  const isUsdt = assetAddress === usdtAddress[chainId as keyof typeof usdtAddress];
  const approveAbi = isUsdt ? usdtAbi : erc20Abi;

  // Check current allowance for the underlying asset
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: assetAddress,
    owner: connectedAddress,
    spender: vaultAddress
  });

  const hasAllowance = allowance !== undefined && allowance >= amount;

  // Build the deposit call. ERC-4626 deposit(assets, receiver) for Morpho; Spark
  // additionally carries the on-chain referral code via the 3-arg overload.
  // receiver is the connected address - they receive the vault shares.
  const depositCall = buildVaultDepositCall({
    provider,
    vaultAddress,
    amount,
    receiver: connectedAddress!,
    referral
  });

  // Conditionally include approve calls if allowance is insufficient
  const calls: Call[] = [];
  if (!hasAllowance) {
    // USDT requires resetting allowance to 0 before setting a new value
    if (isUsdt && allowance !== undefined && allowance > 0n) {
      calls.push(
        getWriteContractCall({
          to: assetAddress,
          abi: approveAbi,
          functionName: 'approve',
          args: [vaultAddress, 0n]
        })
      );
    }
    calls.push(
      getWriteContractCall({
        to: assetAddress,
        abi: approveAbi,
        functionName: 'approve',
        args: [vaultAddress, amount]
      })
    );
  }
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
