import { usdsSkyRewardAbi } from '../generated';
import { useAccount, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { Call, erc20Abi } from 'viem';
import { useSendBatchTransactionFlow } from '../shared/useSendBatchTransactionFlow';

// Allows user to supply in a rewards contract
// We need to provide the contract address of the rewards contract since there are many of them
export function useBatchRewardsSupply({
  contractAddress,
  supplyTokenAddress,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  amount,
  enabled: paramEnabled,
  ref = 0
}: BatchWriteHookParams & {
  amount: bigint;
  contractAddress: `0x${string}` | undefined;
  supplyTokenAddress: `0x${string}` | undefined;
  ref?: number;
}): BatchWriteHook {
  const chainId = useChainId();

  const { address } = useAccount();
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: supplyTokenAddress,
    spender: contractAddress,
    owner: address
  });

  const hasAllowance = allowance !== undefined && allowance >= amount;

  // Calls for the batch transaction
  const calls: Call[] = [];
  if (!!supplyTokenAddress && !!contractAddress) {
    const approveCall = getWriteContractCall({
      to: supplyTokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contractAddress, amount]
    });

    const supplyCall = getWriteContractCall({
      to: contractAddress,
      abi: usdsSkyRewardAbi, // we should be able to use any rewards contract abi here,
      functionName: 'stake',
      args: [amount, ref]
    });

    if (!hasAllowance) calls.push(approveCall);
    calls.push(supplyCall);
  }

  const amountValid = !!amount && amount !== 0n;
  const addressValid = !!address && address !== ZERO_ADDRESS;
  const enabled =
    !!paramEnabled &&
    amountValid &&
    addressValid &&
    !!contractAddress &&
    !!supplyTokenAddress &&
    allowance !== undefined;

  const sendBatchTransactionFlowResults = useSendBatchTransactionFlow({
    calls,
    chainId,
    enabled,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...sendBatchTransactionFlowResults,
    error: sendBatchTransactionFlowResults.error || allowanceError
  };
}
