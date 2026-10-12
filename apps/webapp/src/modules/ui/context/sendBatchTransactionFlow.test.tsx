import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UnknownBundleIdError,
  UnknownRpcError,
  UnsupportedProviderMethodError,
  WaitForCallsStatusTimeoutError,
  erc20Abi,
  type Call
} from 'viem';

// The cross-chain-calldata backstop (APP-528): the shared batch flow itself
// must refuse a batch whose target address resolved to `undefined` — the shape
// a `Record<chainId, address>` takes when read on a chain the product isn't on.
// This is the last line of defense behind the modal's chain guard. The bundle
// simulation added in APP-537 runs ahead of it and is stubbed green here so the
// backstop is what these cases exercise.

const sendCallsSpy = vi.hoisted(() => vi.fn());
const capabilities = vi.hoisted(() => ({ data: true as boolean | undefined, isLoading: false }));
const idleStatus = { isLoading: false, isSuccess: false, error: null, failureReason: null, data: undefined };
const bundle = vi.hoisted(() => ({
  id: undefined as string | undefined,
  status: undefined as Record<string, any> | undefined,
  statusParams: undefined as Record<string, any> | undefined
}));

vi.mock('wagmi', () => ({
  useSendCalls: () => ({
    sendCalls: sendCallsSpy,
    error: null,
    data: bundle.id ? { id: bundle.id } : undefined,
    reset: vi.fn()
  }),
  useWaitForCallsStatus: (params: Record<string, any>) => {
    bundle.statusParams = params;
    return bundle.status ?? idleStatus;
  }
}));

vi.mock('@/hooks/shared/useSimulateBatch', () => ({
  useSimulateBatch: () => ({
    prepared: true,
    isLoading: false,
    error: null,
    structuralFailure: false,
    refetch: vi.fn()
  })
}));

vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({
    data: capabilities.data,
    isLoading: capabilities.isLoading,
    error: null
  })
}));

import { useSendBatchTransactionFlow } from '@/hooks/shared/useSendBatchTransactionFlow';

const goodCall = (to: `0x${string}`): Call =>
  ({
    to,
    abi: erc20Abi,
    functionName: 'approve',
    args: ['0xA188EEC8F81263234dA3622A406892F3D630f98c', 1n]
  }) as unknown as Call;

// A call whose target resolved to undefined — `assetAddress[wrongChain]`.
const nullTargetCall = (): Call =>
  ({
    to: undefined,
    abi: erc20Abi,
    functionName: 'approve',
    args: ['0xA188EEC8F81263234dA3622A406892F3D630f98c', 1n]
  }) as unknown as Call;

beforeEach(() => {
  sendCallsSpy.mockClear();
  capabilities.data = true;
  capabilities.isLoading = false;
});

afterEach(cleanup);

describe('useSendBatchTransactionFlow — cross-chain backstop (APP-528)', () => {
  it('sends a valid two-call batch', () => {
    const calls = [
      goodCall('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
      goodCall('0x6B175474E89094C44Da98b954EedeAC495271d0F')
    ];
    const { result } = renderHook(() =>
      useSendBatchTransactionFlow({ calls, enabled: true, chainId: 1 } as never)
    );

    result.current.execute();
    expect(sendCallsSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses a batch whose target address is undefined (wrong-chain resolution miss) and reports it through onError', () => {
    const calls = [nullTargetCall(), goodCall('0x6B175474E89094C44Da98b954EedeAC495271d0F')];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useSendBatchTransactionFlow({ calls, enabled: true, chainId: 8453, onError } as never)
    );

    result.current.execute();

    expect(sendCallsSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    // Surfaced like any failed send — the modal has already advanced to its
    // transaction screen, so a silent refusal would strand it on "Preparing".
    expect(onError).toHaveBeenCalledTimes(1);
    const [error, hash] = onError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/no target address/);
    expect(hash).toBeUndefined();
    errorSpy.mockRestore();
  });
});

describe('useSendBatchTransactionFlow — status polling (APP-619)', () => {
  const pollingOptions = () => {
    renderHook(() => useSendBatchTransactionFlow({ calls: [], enabled: true, chainId: 1 } as never));
    return bundle.statusParams!.query;
  };

  it('keeps polling until the wallet says it never can answer', () => {
    const { retry } = pollingOptions();
    expect(retry(9, new WaitForCallsStatusTimeoutError({ id: '0x1' }))).toBe(true);
    expect(retry(1, new Error('HTTP request failed. Status: 503'))).toBe(true);
    expect(retry(50, Object.assign(new Error('Internal error'), { code: -32603 }))).toBe(true);
    expect(retry(1, new Error('execution reverted'))).toBe(true);
    // A locked wallet can answer 4100 and recover once unlocked.
    expect(retry(3, Object.assign(new Error('Unauthorized'), { code: 4100 }))).toBe(true);
    for (const permanent of [UnsupportedProviderMethodError, UnknownBundleIdError]) {
      expect(retry(1, new UnknownRpcError(new permanent(new Error('wallet'))))).toBe(false);
    }
  });

  it('starts the next poll straight away when an attempt times out, and backs off to at most 30s on errors', () => {
    const { retryDelay } = pollingOptions();
    expect(retryDelay(9, new WaitForCallsStatusTimeoutError({ id: '0x1' }))).toBe(0);
    expect(retryDelay(0, new Error('503'))).toBe(1000);
    expect(retryDelay(20, new Error('503'))).toBe(30_000);
  });

  it('reads the outcome from the bundle status, never from error text', () => {
    const onError = vi.fn();
    bundle.id = '0xb';
    // A poll that failed with revert-like text, still being retried.
    bundle.status = { ...idleStatus, isLoading: true, failureReason: new Error('execution reverted') };
    try {
      const { result, rerender } = renderHook(() =>
        useSendBatchTransactionFlow({ calls: [], enabled: true, chainId: 1, onError } as never)
      );
      expect(onError).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(true);

      bundle.status = { ...idleStatus, isSuccess: true, data: { status: 'failure', receipts: [] } };
      rerender();
      expect(onError).toHaveBeenCalledTimes(1);
    } finally {
      bundle.id = undefined;
      bundle.status = undefined;
    }
  });
});
