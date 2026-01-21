import {
  UseSimulateContractParameters,
  useConnection,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { isRevertedError } from '../helpers';
import { useEffect, useMemo } from 'react';
import { Config, ResolvedRegister } from '@wagmi/core';
import { SAFE_CONNECTOR_ID } from './constants';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';
import type { UseWriteContractFlowParameters, WriteHook } from '../hooks';
import type { Abi, ContractFunctionArgs, ContractFunctionName } from 'viem';

export function useWriteContractFlow<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName>,
  config extends Config = ResolvedRegister['config'],
  chainId extends config['chains'][number]['id'] | undefined = undefined
>(parameters: UseWriteContractFlowParameters<abi, functionName, args, config, chainId>): WriteHook {
  const {
    enabled,
    gcTime,
    onMutate = () => null,
    onSuccess = () => null,
    onError = () => null,
    onStart = () => null,
    ...useSimulateContractParamters
  } = parameters;

  // Prepare tx config
  const {
    data: simulationData,
    refetch,
    isLoading: isSimulationLoading,
    error: simulationError
  } = useSimulateContract({
    ...useSimulateContractParamters,
    query: { ...useSimulateContractParamters.query, enabled, gcTime: gcTime || 30000 }
  } as UseSimulateContractParameters);

  const {
    writeContract,
    error: writeError,
    data: mutationHash
  } = useWriteContract({
    mutation: {
      onMutate,
      onSuccess: (hash: `0x${string}`) => {
        if (onStart) {
          onStart(hash);
        }
      },
      onError: (err: Error) => {
        if (onError) {
          onError(err, mutationHash || '');
        }
      }
    }
  });

  // Workaround to get `txHash` from Safe connector
  const { connector } = useConnection();
  const isSafeConnector = connector?.id === SAFE_CONNECTOR_ID;

  const eventHash = useWaitForSafeTxHash({
    chainId: parameters.chainId,
    safeTxHash: mutationHash,
    isSafeConnector
  });

  // If the user is currently connected through the Safe connector, the txHash will only
  // be populated after we get it from the Safe wallet contract event, if they're connected
  // to any other connector, the txHash will be the one we get from the mutation
  const txHash = useMemo(
    () => (isSafeConnector ? eventHash : mutationHash),
    [eventHash, mutationHash, isSafeConnector]
  );

  // Monitor tx
  const {
    isLoading: isMining,
    isSuccess,
    error: miningError,
    failureReason
  } = useWaitForTransactionReceipt({
    hash: txHash
  });
  const txReverted = isRevertedError(failureReason);

  useEffect(() => {
    if (txHash) {
      if (isSuccess) {
        onSuccess(txHash);
      } else if (miningError) {
        onError(miningError, txHash);
      } else if (failureReason && txReverted) {
        onError(failureReason, txHash);
      }
    }
  }, [isSuccess, miningError, failureReason, txHash, txReverted]);

  return {
    execute: () => {
      if (simulationData?.request) {
        writeContract(simulationData.request);
      } else {
        console.log(`ERROR: the contract interaction was triggered before the call was ready.
          contract address: ${useSimulateContractParamters.address}
          function name: ${useSimulateContractParamters.functionName}
          function arguments: ${useSimulateContractParamters.args}
          isSimulationLoading: ${isSimulationLoading}
          simulationError: ${simulationError}
          enabled: ${enabled}`);
      }
    },
    data: txHash,
    isLoading: isSimulationLoading || (isMining && !txReverted),
    error: writeError || miningError,
    prepareError: simulationError,
    prepared: !!simulationData?.request,
    retryPrepare: refetch
  };
}
