import { UseQueryOptions } from '@tanstack/react-query';
import {
  type SendTransactionReturnType,
  type WriteContractReturnType,
  type SimulateContractErrorType,
  type Config,
  type SendCallsParameters
} from '@wagmi/core';
import { type Abi, type ContractFunctionArgs, type ContractFunctionName } from 'viem';
import type { UseSimulateContractParameters } from 'wagmi';

export type ReadHook = {
  error: Error | null;
  isLoading: boolean;
  mutate: () => void;
  dataSources: DataSource[];
};

/*
 * Write contract flow hook
 */
export type WriteHook = {
  data: WriteContractReturnType | undefined;
  error: Error | null;
  isLoading: boolean;
  execute: () => void;
  retryPrepare: () => void;
  prepareError: Error | SimulateContractErrorType | null;
  prepared: boolean;
};

export type WriteHookParams = {
  onStart?: (hash: string) => void;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error, hash: string) => void;
  enabled?: boolean;
  gas?: bigint;
};

export type UseWriteContractFlowParameters<
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

/*
 * Send batch transaction flow hook
 */
export type BatchWriteHook = {
  error: Error | null;
  isLoading: boolean;
  prepared: boolean;
  execute: () => void;
};

export type BatchWriteHookParams = {
  onStart?: () => void;
  onSuccess?: (hash: string | undefined) => void;
  onError?: (error: Error, hash: string | undefined) => void;
  enabled?: boolean;
  gas?: bigint;
};

export type UseSendBatchTransactionFlowParameters<
  calls extends readonly unknown[],
  config extends Config = Config,
  chainId extends config['chains'][number]['id'] | undefined = undefined
> = SendCallsParameters<config, chainId, calls> & {
  enabled?: boolean;
  onStart?: () => void;
  onSuccess?: (hash: string | undefined) => void;
  onError?: (error: Error, hash: string | undefined) => void;
};

export type TransactionHook = WriteHook & {
  data: SendTransactionReturnType | undefined;
};

export type ReadHookParams<TData = unknown> = Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>;

export type DataSource = {
  href: string;
  title: string;
  onChain: boolean;
  trustLevel: TrustLevel;
};

export type TrustLevel = {
  level: 0 | 1 | 2;
  title: string;
  description: string;
};
