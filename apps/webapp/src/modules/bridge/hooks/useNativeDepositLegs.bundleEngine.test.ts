/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, parseEther } from 'viem';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { useNativeDepositLegs } from './useNativeDepositLegs';

// The open bundles are counted per account across mounts: each test signs with its own.
let accounts = 0x900;
const nextAccount = () =>
  getAddress(`0x71c7656ec7ab88b098defb751b74${(++accounts).toString(16).padStart(12, '0')}`);

const PROMPT_OPEN = new Error('Approve or reject the request in your wallet before sending again.');

const mocks = vi.hoisted(() => ({
  status: 'success' as 'success' | 'failure',
  sends: [] as { resolve: (value: { id: string }) => void; reject: (error: Error) => void }[]
}));

// The real batch engine runs over a real mutation: only the wallet's answer and the bundle's status are faked.
vi.mock('wagmi', async io => {
  const { useMutation } = await import('@tanstack/react-query');
  return {
    ...(await io<typeof import('wagmi')>()),
    usePublicClient: () => ({ readContract: () => Promise.resolve(1n) }),
    useSendCalls: ({ mutation }: { mutation: Record<string, unknown> }) => {
      const m = useMutation({
        ...mutation,
        mutationFn: () =>
          new Promise<{ id: string }>((resolve, reject) => mocks.sends.push({ resolve, reject }))
      });
      return { sendCalls: () => m.mutate(undefined as never), error: m.error, data: m.data, reset: m.reset };
    },
    useWaitForCallsStatus: ({ id }: { id?: string }) =>
      id
        ? {
            isLoading: false,
            isSuccess: true,
            error: null,
            failureReason: null,
            data: { status: mocks.status, receipts: [{ transactionHash: '0xabc', blockNumber: 5n }] }
          }
        : { isLoading: false, isSuccess: false, error: null, failureReason: null, data: undefined }
  };
});
vi.mock('@/hooks', () => ({
  useTokenAllowance: () => ({ data: 0n, error: null, mutate: vi.fn() })
}));
vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({ data: true, isLoading: false, error: null })
}));
vi.mock('@/hooks/shared/useSimulateBatch', () => ({
  useSimulateBatch: () => ({ prepared: true, isLoading: false, error: null, structuralFailure: false })
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: () => ({
    execute: vi.fn(),
    reset: vi.fn(),
    prepared: true,
    isLoading: false,
    error: null,
    currentCallIndex: 0
  })
}));

const makeCallbacks = (): TxCallbacks => ({
  onMutate: vi.fn(),
  onStart: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn()
});
let current = makeCallbacks();

const renderLegs = (account: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(
    ({ account }: { account: string }) =>
      useNativeDepositLegs({
        enabled: true,
        to: 'base',
        chainId: 1,
        account,
        recipient: undefined,
        amount: parseEther('25'),
        batch: true,
        getCallbacks: () => current
      }),
    { wrapper, initialProps: { account } }
  );
};
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise(resolve => setTimeout(resolve, 0)));
};
const send = async (result: { current: ReturnType<typeof useNativeDepositLegs> }) => {
  const count = mocks.sends.length;
  act(() => result.current.execute());
  await waitFor(() => expect(mocks.sends).toHaveLength(count + 1));
  return mocks.sends[count];
};

describe('useNativeDepositLegs, a bundle the wallet answers after its run ended', () => {
  beforeEach(() => {
    current = makeCallbacks();
    mocks.status = 'success';
    mocks.sends = [];
  });

  it('reports an approved bundle and its success', async () => {
    const { result } = renderLegs(nextAccount());
    await settle();
    const wallet = await send(result);
    await act(async () => wallet.resolve({ id: '0xcalls' }));
    await settle();
    expect(current.onSuccess).toHaveBeenCalledWith('0xabc', 5n);
  });

  it('reaches a verdict for a bundle approved after the account changed, so the modal is not left loading', async () => {
    const { result, rerender } = renderLegs(nextAccount());
    await settle();
    const wallet = await send(result);
    rerender({ account: nextAccount() });
    expect(current.onError).toHaveBeenCalledWith(
      new Error('The wallet account changed during the bridge.'),
      ''
    );
    await act(async () => wallet.resolve({ id: '0xcalls' }));
    await settle();
    expect(current.onStart).toHaveBeenCalledWith(undefined);
    expect(current.onSuccess).toHaveBeenCalledWith('0xabc', 5n);
  });

  it('reports a failed bundle approved after its modal closed, so its card fails', async () => {
    mocks.status = 'failure';
    const { result } = renderLegs(nextAccount());
    await settle();
    const wallet = await send(result);
    act(() => result.current.stop());
    await act(async () => wallet.resolve({ id: '0xcalls' }));
    await settle();
    expect(current.onStart).toHaveBeenCalledWith(undefined);
    expect(current.onError).toHaveBeenCalledWith(new Error('ERROR: Batch transaction failed'), undefined);
  });

  it('frees the account once it rejects a bundle opened before the account changed', async () => {
    const account = nextAccount();
    const { result, rerender } = renderLegs(account);
    await settle();
    const wallet = await send(result);
    rerender({ account: nextAccount() });
    await act(async () => wallet.reject(new Error('User rejected the request.')));
    await settle();
    rerender({ account });
    await settle();
    current = makeCallbacks();
    await send(result);
    expect(current.onError).not.toHaveBeenCalledWith(PROMPT_OPEN, '');
  });
});
