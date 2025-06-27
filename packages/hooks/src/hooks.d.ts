import { UseQueryOptions } from '@tanstack/react-query';
import {
  type SendTransactionReturnType,
  type WriteContractReturnType,
  type SimulateContractErrorType
} from '@wagmi/core';

export type ReadHook = {
  error: Error | null;
  isLoading: boolean;
  mutate: () => void;
  dataSources: DataSource[];
};

export type WriteHook = {
  data: WriteContractReturnType | undefined;
  error: Error | null;
  isLoading: boolean;
  execute: () => void;
  retryPrepare: () => void;
  prepareError: Error | SimulateContractErrorType | null;
  prepared: boolean;
};

export type TransactionHook = WriteHook & {
  data: SendTransactionReturnType | undefined;
};

export type ReadHookParams<TData = unknown> = Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>;

export type WriteHookParams = {
  onStart?: (hash: string) => void;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error, hash: string) => void;
  enabled?: boolean;
  gas?: bigint;
};

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
