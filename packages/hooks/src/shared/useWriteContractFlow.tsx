import {
  UseSimulateContractParameters,
  useAccount,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract
} from 'wagmi';
import { isRevertedError } from '../helpers';
import { useEffect, useMemo, useState } from 'react';
import type { WriteHook } from '../hooks';
import { type Abi, type ContractFunctionArgs, type ContractFunctionName } from 'viem';
import { Config, ResolvedRegister } from '@wagmi/core';
import { SAFE_CONNECTOR_ID, safeAbi } from './constants';

type UseWriteContractFlowParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'> = ContractFunctionName<
    abi,
    'nonpayable' | 'payable'
  >,
  args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName> = ContractFunctionArgs<
    abi,
    'nonpayable' | 'payable',
    functionName
  >,
  config extends Config = Config,
  chainId extends config['chains'][number]['id'] | undefined = undefined
> = UseSimulateContractParameters<abi, functionName, args, config, chainId> & {
  enabled: boolean;
  gcTime?: number;
  onStart?: (hash: string) => void;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error, hash: string) => void;
};

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
      onSuccess: (hash: `0x${string}`) => {
        onStart(hash);
      },
      onError: (err: Error) => {
        onError && onError(err, mutationHash || '');
      }
    }
  });

  // Workaround to get `txHash` from Safe connector
  const { connector, address: connectedAddress } = useAccount();
  const isSafeConnector = connector?.id === SAFE_CONNECTOR_ID;
  const [eventHash, setEventHash] = useState<`0x${string}` | undefined>();
  useWatchContractEvent({
    abi: safeAbi,
    address: connectedAddress,
    eventName: 'ExecutionSuccess',
    chainId: useSimulateContractParamters.chainId,
    args: { txHash: mutationHash },
    onLogs: logs => {
      setEventHash(logs?.[0].transactionHash);
    },
    enabled: isSafeConnector && !!mutationHash
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
        setEventHash(undefined);
      } else if (miningError) {
        onError(miningError, txHash);
        setEventHash(undefined);
      } else if (failureReason && txReverted) {
        onError(failureReason, txHash);
        setEventHash(undefined);
      }
    }
  }, [isSuccess, miningError, failureReason, txHash, txReverted]);

  return {
    execute: () => {
      if (simulationData?.request) {
        writeContract(simulationData.request);
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
