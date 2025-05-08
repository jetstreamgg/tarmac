import { useAccount } from 'wagmi';
import {
  useCapabilities,
  useWriteContracts,
  useCallsStatus,
  type WriteContractsErrorType
} from 'wagmi/experimental';
import {
  type Abi,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type WriteContractErrorType as ViemWriteContractErrorType,
  type Account,
  type TransactionReceipt as ViemTransactionReceipt
} from 'viem';
import { type Config, type ResolvedRegister } from '@wagmi/core';
import { useEffect, useState, useCallback, useMemo } from 'react';

// Define the structure for a single call within a batch
export type BatchContractCall<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'> = ContractFunctionName<
    abi,
    'nonpayable' | 'payable'
  >,
  args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName> = ContractFunctionArgs<
    abi,
    'nonpayable' | 'payable',
    functionName
  >
> = {
  address: `0x${string}`;
  abi: abi;
  functionName: functionName;
  args: args;
};

// Parameters for the useWriteBatchContractFlow hook
export type UseWriteBatchContractFlowParameters<
  config extends Config = Config,
  chainId extends config['chains'][number]['id'] | undefined = undefined,
  context = unknown
> = {
  calls: readonly BatchContractCall<any, any, any>[];
  chainId?: chainId;
  enabled?: boolean;
  mutation?: {
    onMutate?: (variables: {
      calls: readonly BatchContractCall<any, any, any>[];
      chainId?: number;
      account?: Account | `0x${string}`;
    }) => context | Promise<context>;
    onSettled?: (
      data: `0x${string}` | undefined,
      error: ViemWriteContractErrorType | null,
      variables: {
        calls: readonly BatchContractCall<any, any, any>[];
        chainId?: number;
        account?: Account | `0x${string}`;
      },
      context?: context
    ) => void;
    onSuccess?: (
      data: `0x${string}`,
      variables: {
        calls: readonly BatchContractCall<any, any, any>[];
        chainId?: number;
        account?: Account | `0x${string}`;
      },
      context: context
    ) => void;
    onError?: (
      error: ViemWriteContractErrorType,
      variables: {
        calls: readonly BatchContractCall<any, any, any>[];
        chainId?: number;
        account?: Account | `0x${string}`;
      },
      context?: context
    ) => void;
  };
  account?: Account | `0x${string}` | undefined;
  capabilities?: { batch?: boolean | undefined } | undefined;
};

// Return type for the hook
export type WriteBatchHook<
  config extends Config = Config,
  chainId extends config['chains'][number]['id'] | undefined = undefined
> = {
  writeContracts: (variables: {
    contracts: readonly BatchContractCall<any, any, any>[];
    chainId?: chainId | number;
    account?: Account | `0x${string}`;
    capabilities?: { batch?: boolean };
  }) => void | undefined;
  writeContractsAsync: (variables: {
    contracts: readonly BatchContractCall<any, any, any>[];
    chainId?: chainId | number;
    account?: Account | `0x${string}`;
    capabilities?: { batch?: boolean };
  }) => Promise<`0x${string}`>;
  data: `0x${string}` | undefined;
  isAtomicBatchSupported: boolean | undefined;
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: WriteContractsErrorType | ViemWriteContractErrorType | Error | null;
  status:
    | 'IDLE'
    | 'PENDING_WALLET_ACTION'
    | 'UNSUPPORTED'
    | 'ERROR_CAPABILITIES'
    | 'CONFIRMED'
    | 'REVERTED'
    | 'PENDING'
    | 'ERROR';
  receipts: readonly ViemTransactionReceipt[] | undefined;
  reset: () => void;
};

// Type for the data returned by useCallsStatus
type CallsStatusData = NonNullable<ReturnType<typeof useCallsStatus>['data']>;

export function useWriteBatchContractFlow<
  config extends Config = ResolvedRegister['config'],
  chainId extends config['chains'][number]['id'] | undefined = undefined,
  context = unknown
>(
  parameters: UseWriteBatchContractFlowParameters<config, chainId, context>
): WriteBatchHook<config, chainId, context> {
  const {
    calls: parameterCalls,
    chainId: parameterChainId,
    enabled = true,
    mutation: userMutation,
    account,
    capabilities: parameterCapabilities
  } = parameters;

  const { chain: connectedChain, address: connectedAddress } = useAccount();
  const targetChainId = parameterChainId ?? connectedChain?.id;
  const targetAccount = account ?? connectedAddress;

  const {
    data: capabilitiesData,
    isLoading: capabilitiesLoading,
    error: capabilitiesErrorHook
  } = useCapabilities({
    account: targetAccount,
    query: { enabled: enabled && !!targetChainId }
  });

  const isAtomicBatchSupported = useMemo(() => {
    if (!enabled || !targetChainId || capabilitiesLoading || !capabilitiesData) return undefined;
    return capabilitiesData[targetChainId as number]?.atomicBatch?.supported ?? false;
  }, [enabled, targetChainId, capabilitiesLoading, capabilitiesData]);

  // This type represents the 'variables' object that wagmi's useWriteContracts
  // passes to its own onMutate, onSuccess, onError, onSettled callbacks.
  type WagmiHookVariables = Parameters<typeof useWriteContracts>[0]['variables'];

  // Explicit type for the mutation object expected by useWriteContracts
  type WagmiInternalMutation = {
    onMutate?: (variables: WagmiHookVariables) => Promise<context | undefined> | context | undefined;
    onSuccess?: (data: `0x${string}`, variables: WagmiHookVariables, context: context | undefined) => void;
    onError?: (
      error: WriteContractsErrorType,
      variables: WagmiHookVariables,
      context: context | undefined
    ) => void;
    onSettled?: (
      data: `0x${string}` | undefined,
      error: WriteContractsErrorType | null,
      variables: WagmiHookVariables,
      context: context | undefined
    ) => void;
  };

  const wagmiMutation = useMemo((): WagmiInternalMutation | undefined => {
    if (!userMutation) return undefined;

    const transformVariablesForUser = (wagmiVars: WagmiHookVariables) => ({
      calls: wagmiVars.contracts as readonly BatchContractCall<any, any, any>[],
      chainId: wagmiVars.chainId,
      account: wagmiVars.account as Account | `0x${string}` | undefined
    });

    return {
      onMutate: userMutation.onMutate
        ? (wagmiVariables: WagmiHookVariables) => {
            return userMutation.onMutate!(transformVariablesForUser(wagmiVariables));
          }
        : undefined,
      onSuccess: userMutation.onSuccess
        ? (data: `0x${string}`, wagmiVariables: WagmiHookVariables, cbContext: context | undefined) => {
            return userMutation.onSuccess!(
              data,
              transformVariablesForUser(wagmiVariables),
              cbContext as context
            );
          }
        : undefined,
      onError: userMutation.onError
        ? (
            error: WriteContractsErrorType,
            wagmiVariables: WagmiHookVariables,
            cbContext: context | undefined
          ) => {
            return userMutation.onError!(
              error as ViemWriteContractErrorType,
              transformVariablesForUser(wagmiVariables),
              cbContext as context
            );
          }
        : undefined,
      onSettled: userMutation.onSettled
        ? (
            data: `0x${string}` | undefined,
            error: WriteContractsErrorType | null,
            wagmiVariables: WagmiHookVariables,
            cbContext: context | undefined
          ) => {
            return userMutation.onSettled!(
              data,
              error as ViemWriteContractErrorType | null,
              transformVariablesForUser(wagmiVariables),
              cbContext as context
            );
          }
        : undefined
    };
  }, [userMutation]);

  const {
    data: callBundleId,
    writeContracts: wagmiWriteContracts,
    writeContractsAsync: wagmiWriteContractsAsync,
    isPending: isWriteContractsPending,
    error: writeContractsError,
    reset: resetWriteContracts,
    status: writeContractsStatus
  } = useWriteContracts({
    mutation: wagmiMutation
  });

  const {
    data: callsStatusData,
    error: callsStatusError,
    isLoading: isCallsStatusLoading
  } = useCallsStatus({
    id: callBundleId,
    query: {
      enabled: enabled && !!callBundleId && isAtomicBatchSupported === true,
      refetchInterval: (query: { state: { data: CallsStatusData | undefined } }) => {
        const data = query.state.data;
        return data?.status === 'CONFIRMED' || data?.status === 'REVERTED' ? false : 1000;
      }
    }
  });

  const [internalError, setInternalError] = useState<Error | null>(null);

  useEffect(() => {
    if (capabilitiesErrorHook) {
      setInternalError(new Error(`Capabilities check failed: ${capabilitiesErrorHook.message}`));
    } else if (enabled && isAtomicBatchSupported === false && parameterCalls && parameterCalls.length > 0) {
      setInternalError(
        new Error('Atomic batch transactions are not supported by the connected wallet for this chain.')
      );
    } else {
      setInternalError(null);
    }
  }, [enabled, isAtomicBatchSupported, capabilitiesErrorHook, parameterCalls]);

  const executeBatch = useCallback(
    (vars?: {
      contracts: readonly BatchContractCall<any, any, any>[];
      chainId?: chainId | number;
      account?: Account | `0x${string}`;
      capabilities?: { batch?: boolean };
    }): void | undefined => {
      const executionVariables = vars ?? {
        contracts: parameterCalls,
        chainId: targetChainId,
        account: targetAccount,
        capabilities: parameterCapabilities
      };

      if (!enabled) {
        console.warn('useWriteBatchContractFlow: Hook is not enabled.');
        setInternalError(new Error('Hook is not enabled.'));
        return;
      }
      if (isAtomicBatchSupported === undefined && !capabilitiesErrorHook) {
        console.warn('useWriteBatchContractFlow: Atomic batch support status is not yet determined.');
        setInternalError(new Error('Atomic batch support status not yet determined.'));
        return;
      }
      if (isAtomicBatchSupported === false) {
        console.warn(
          'useWriteBatchContractFlow: Atomic batch transactions are not supported (executeBatch). Error already set.'
        );
        return;
      }
      if (capabilitiesErrorHook) {
        console.warn('useWriteBatchContractFlow: Capabilities error (executeBatch). Error already set.');
        return;
      }
      if (!executionVariables.contracts || executionVariables.contracts.length === 0) {
        console.warn('useWriteBatchContractFlow: No contracts provided to execute.');
        setInternalError(new Error('No contracts provided to execute.'));
        return;
      }

      setInternalError(null);
      return wagmiWriteContracts(executionVariables);
    },
    [
      parameterCalls,
      targetChainId,
      targetAccount,
      parameterCapabilities,
      enabled,
      isAtomicBatchSupported,
      wagmiWriteContracts,
      capabilitiesErrorHook
    ]
  );

  const executeBatchAsync = useCallback(
    async (vars?: {
      contracts: readonly BatchContractCall<any, any, any>[];
      chainId?: chainId | number;
      account?: Account | `0x${string}`;
      capabilities?: { batch?: boolean };
    }): Promise<`0x${string}`> => {
      const executionVariables = vars ?? {
        contracts: parameterCalls,
        chainId: targetChainId,
        account: targetAccount,
        capabilities: parameterCapabilities
      };

      if (!enabled) {
        throw new Error('useWriteBatchContractFlow: Hook is not enabled.');
      }
      if (isAtomicBatchSupported === undefined && !capabilitiesErrorHook) {
        throw new Error('useWriteBatchContractFlow: Atomic batch support status is not yet determined.');
      }
      if (isAtomicBatchSupported === false) {
        throw new Error(
          'useWriteBatchContractFlow: Atomic batch transactions are not supported by the connected wallet for this chain.'
        );
      }
      if (capabilitiesErrorHook) {
        throw new Error(`useWriteBatchContractFlow: Capabilities error: ${capabilitiesErrorHook.message}`);
      }
      if (!executionVariables.contracts || executionVariables.contracts.length === 0) {
        throw new Error('useWriteBatchContractFlow: No contracts provided to execute.');
      }

      setInternalError(null);
      return wagmiWriteContractsAsync(executionVariables);
    },
    [
      parameterCalls,
      targetChainId,
      targetAccount,
      parameterCapabilities,
      enabled,
      isAtomicBatchSupported,
      wagmiWriteContractsAsync,
      capabilitiesErrorHook
    ]
  );

  const isLoading = useMemo(() => {
    return (
      capabilitiesLoading ||
      isWriteContractsPending ||
      (!!callBundleId &&
        isCallsStatusLoading &&
        callsStatusData?.status !== 'CONFIRMED' &&
        callsStatusData?.status !== 'REVERTED')
    );
  }, [
    capabilitiesLoading,
    isWriteContractsPending,
    callBundleId,
    isCallsStatusLoading,
    callsStatusData?.status
  ]);

  const overallError = useMemo(() => {
    return internalError || capabilitiesErrorHook || writeContractsError || callsStatusError;
  }, [internalError, capabilitiesErrorHook, writeContractsError, callsStatusError]);

  const currentStatus = useMemo((): WriteBatchHook<config, chainId, context>['status'] => {
    if (!enabled) return 'IDLE';
    if (capabilitiesLoading) return 'PENDING_WALLET_ACTION';
    if (capabilitiesErrorHook) return 'ERROR_CAPABILITIES';
    if (isAtomicBatchSupported === false && parameterCalls && parameterCalls.length > 0) return 'UNSUPPORTED';
    if (isAtomicBatchSupported === undefined && !capabilitiesLoading) return 'ERROR_CAPABILITIES';

    if (writeContractsStatus === 'pending') return 'PENDING_WALLET_ACTION';
    if (writeContractsStatus === 'error' && writeContractsError) return 'ERROR';

    if (callBundleId) {
      if (callsStatusData?.status === 'PENDING') return 'PENDING';
      if (callsStatusData?.status === 'CONFIRMED') return 'CONFIRMED';
      if (callsStatusData?.status === 'REVERTED') return 'REVERTED';
      if (isCallsStatusLoading) return 'PENDING';
      if (callsStatusError) return 'ERROR';
    }

    if (writeContractsStatus === 'idle') return 'IDLE';
    if (writeContractsStatus === 'success' && !callBundleId) return 'IDLE';

    return 'IDLE';
  }, [
    enabled,
    isAtomicBatchSupported,
    capabilitiesLoading,
    capabilitiesErrorHook,
    writeContractsStatus,
    writeContractsError,
    callBundleId,
    callsStatusData?.status,
    isCallsStatusLoading,
    callsStatusError,
    parameterCalls
  ]);

  const isSuccess = useMemo(
    () =>
      currentStatus === 'CONFIRMED' &&
      callsStatusData?.receipts?.every((r: ViemTransactionReceipt) => r.status === 'success'),
    [currentStatus, callsStatusData?.receipts]
  );

  const reset = useCallback(() => {
    resetWriteContracts();
    setInternalError(null);
  }, [resetWriteContracts]);

  return {
    writeContracts: executeBatch,
    writeContractsAsync: executeBatchAsync,
    data: callBundleId,
    isAtomicBatchSupported,
    isLoading,
    isPending: currentStatus === 'PENDING_WALLET_ACTION' || currentStatus === 'PENDING',
    isSuccess,
    isError:
      currentStatus === 'ERROR' ||
      currentStatus === 'ERROR_CAPABILITIES' ||
      currentStatus === 'REVERTED' ||
      !!overallError,
    error: overallError as WriteContractsErrorType | ViemWriteContractErrorType | Error | null,
    status: currentStatus,
    receipts: callsStatusData?.receipts,
    reset
  };
}
