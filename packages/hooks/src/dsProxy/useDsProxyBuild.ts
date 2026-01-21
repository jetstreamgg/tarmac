import { useConnection, useWaitForTransactionReceipt } from 'wagmi';
import { useSimulateProxyRegistry, useWriteProxyRegistry } from '../generated';
import { WriteHookParams, WriteHook } from '../hooks';
import { useDsProxyData } from './useDsProxyData';
import { ZERO_ADDRESS } from '../constants';
import { useEffect } from 'react';
import { isRevertedError } from '../helpers';

export function useDsProxyBuild({
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  gas
}: WriteHookParams): WriteHook {
  const { address: connectedAddress } = useConnection();
  const acct = connectedAddress || ZERO_ADDRESS;
  const { data: dsProxy, isLoading: loadingProxy, error: dsProxyError } = useDsProxyData(acct);

  const {
    data: buildData,
    refetch,
    isLoading: isBuildDataLoading,
    error: prepareError
  } = useSimulateProxyRegistry({
    functionName: 'build',
    args: [connectedAddress || ZERO_ADDRESS] as const,
    gas,
    query: {
      // Only enabled if the user does not already have a proxy, and we are not loading the data
      enabled: Boolean(!dsProxy?.dsProxyAddress && !loadingProxy)
    }
  });

  const {
    writeContract,
    error: writeError,
    data
  } = useWriteProxyRegistry({
    mutation: {
      onSuccess: (hash: `0x${string}`) => {
        onStart(hash);
      },
      onError: (err: Error) => {
        if (onError) {
          onError(err, data || '');
        }
      }
    }
  });

  const {
    isLoading: isProcessing,
    isSuccess: isSuccess,
    error: miningError,
    failureReason
  } = useWaitForTransactionReceipt({
    hash: data
  });
  const txReverted = isRevertedError(failureReason);

  useEffect(() => {
    if (data) {
      if (isSuccess) {
        onSuccess(data);
      } else if (miningError) {
        onError(miningError, data);
      } else if (failureReason && txReverted) {
        onError(failureReason, data);
      }
    }
  }, [isSuccess, miningError, failureReason]);

  return {
    data,
    execute: () => {
      if (buildData?.request) {
        writeContract(buildData.request);
      }
    },
    isLoading: isBuildDataLoading || (isProcessing && !txReverted),
    error: writeError || miningError,
    prepareError: dsProxyError || prepareError,
    prepared: !!buildData?.request,
    retryPrepare: refetch
  };
}
