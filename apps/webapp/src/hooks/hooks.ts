import { UseQueryOptions } from '@tanstack/react-query';
import {
  type SendTransactionReturnType,
  type WriteContractReturnType,
  type SimulateContractErrorType,
  type Config,
  type SendCallsParameters
} from '@wagmi/core';
import { type Call, type Abi, type ContractFunctionArgs, type ContractFunctionName } from 'viem';
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
  /** The calls this hook will send — read-only, for estimating the flow's network fee. */
  calls?: Call[];
  /** Always false: a single contract write is never bundled. Present so flow results are uniform. */
  isBatch?: boolean;
};

/**
 * Variables wagmi hands to the write mutation's onMutate. Sequential legs carry
 * the functionName being signed (used to discriminate approve legs in analytics);
 * batched sendCalls carry none.
 */
export type TxMutateVariables = { functionName?: string };

export type WriteHookParams = {
  onMutate?: (variables?: TxMutateVariables) => void;
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
  onMutate?: (variables?: TxMutateVariables) => void;
  onStart?: (hash: string) => void;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error, hash: string) => void;
};

/*
 * Send batch transaction flow hook
 */
export type BatchWriteHook = {
  /** The hash of the mined batch's first receipt; set once the batch has landed. */
  data?: WriteContractReturnType | undefined;
  error: Error | null;
  isLoading: boolean;
  prepared: boolean;
  execute: () => void;
  currentCallIndex: number;
  reset: () => void;
  /** The calls this hook will send — read-only, for estimating the flow's network fee. */
  calls?: Call[];
  /** Whether those calls will go out bundled, which changes what the flow costs. */
  isBatch?: boolean;
};

export type BatchWriteHookParams = {
  onMutate?: (variables?: TxMutateVariables) => void;
  onStart?: (hash: string | undefined) => void;
  onSuccess?: (hash: string | undefined) => void;
  onError?: (error: Error, hash: string | undefined) => void;
  shouldUseBatch?: boolean;
  enabled?: boolean;
  gas?: bigint;
};

export type UseSendBatchTransactionFlowParameters<
  calls extends readonly unknown[],
  config extends Config = Config,
  chainId extends config['chains'][number]['id'] = config['chains'][number]['id']
> = SendCallsParameters<config, chainId, calls> & {
  enabled?: boolean;
  onMutate?: (variables?: TxMutateVariables) => void;
  onStart?: (hash: string | undefined) => void;
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

export type UseTransactionFlowParameters = {
  calls: Call[];
  shouldUseBatch?: boolean;
  enabled?: boolean;
  onMutate?: (variables?: TxMutateVariables) => void;
  onStart?: (hash: string | undefined) => void;
  onSuccess?: (hash: string | undefined) => void;
  onError?: (error: Error, hash: string | undefined) => void;
  gcTime?: number;
  chainId?: number;
};

export type UseSequentialTransactionFlowParameters = {
  calls: Call[];
  enabled?: boolean;
  onMutate?: (variables?: TxMutateVariables) => void;
  onStart?: (hash: string) => void;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error, hash: string) => void;
  gcTime?: number;
  chainId?: number;
};

export type SequentialTransactionHook = {
  error: Error | null;
  isLoading: boolean;
  execute: () => void;
  prepared: boolean;
  currentCallIndex: number;
  reset: () => void;
};
