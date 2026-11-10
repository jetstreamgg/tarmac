import {
  type Config,
  type ResolvedRegister,
  UseSimulateContractParameters,
  useSimulateContract,
  useWriteContract
} from 'wagmi';
import { useEffect, useEffectEvent } from 'react';
import { reportPrepareRevert } from './prepareRevertReporter';
import { useSentTransactionOutcome } from './useSentTransactionOutcome';
import type { UseWriteContractFlowParameters, WriteHook } from '../hooks';
import type { Abi, Call, ContractFunctionArgs, ContractFunctionName } from 'viem';

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
  } as unknown as UseSimulateContractParameters<abi, functionName, args, config, chainId>);
  useEffect(
    () => reportPrepareRevert(simulationError, parameters.chainId),
    [simulationError, parameters.chainId]
  );

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

  // Monitor tx
  const { txHash, settleHash, isMining, isSuccess, failure, receipt } = useSentTransactionOutcome({
    hash: mutationHash,
    chainId: parameters.chainId
  });

  // The consumer's callbacks are read through effect events: the settle effect
  // must not re-run because a caller passed a new inline function.
  const emitSuccess = useEffectEvent((hash: string, blockNumber?: bigint) => onSuccess(hash, blockNumber));
  const emitError = useEffectEvent((err: Error, hash: string) => onError(err, hash));
  useEffect(() => {
    if (settleHash) {
      if (isSuccess) {
        emitSuccess(settleHash, receipt?.blockNumber);
      } else if (failure) {
        emitError(failure, settleHash);
      }
    }
  }, [isSuccess, failure, settleHash, receipt?.blockNumber]);

  // The single call this hook sends, in the same contract form the batch engines use.
  // Exposed read-only so a flow that routes through here can still be fee-estimated;
  // the cast mirrors `getWriteContractCall`, which viem's `Call` union requires.
  const { address, abi, functionName, args } = useSimulateContractParamters;
  const calls: Call[] =
    address && abi && functionName ? [{ to: address, abi, functionName, args } as Call] : [];

  return {
    calls,
    isBatch: false,
    execute: () => {
      if (simulationData?.request) {
        writeContract(simulationData.request as Parameters<typeof writeContract>[0]);
      } else {
        console.error(`ERROR: the contract interaction was triggered before the call was ready.
          contract address: ${useSimulateContractParamters.address}
          function name: ${useSimulateContractParamters.functionName}
          function arguments: ${useSimulateContractParamters.args}
          isSimulationLoading: ${isSimulationLoading}
          simulationError: ${simulationError}
          enabled: ${enabled}`);
      }
    },
    data: txHash,
    isLoading: isSimulationLoading || isMining,
    error: writeError || failure,
    prepareError: simulationError,
    prepared: !!simulationData?.request,
    retryPrepare: refetch
  };
}
