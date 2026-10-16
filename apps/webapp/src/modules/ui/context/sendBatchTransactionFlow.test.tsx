import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, type Call } from 'viem';

// The cross-chain-calldata backstop (APP-528): the shared batch flow itself
// must refuse a batch whose target address resolved to `undefined` — the shape
// a `Record<chainId, address>` takes when read on a chain the product isn't on.
// This is the last line of defense behind the modal's chain guard. The bundle
// simulation added in APP-537 runs ahead of it and is stubbed green here so the
// backstop is what these cases exercise.

const sendCallsSpy = vi.hoisted(() => vi.fn());
const capabilities = vi.hoisted(() => ({ data: true as boolean | undefined, isLoading: false }));

// The send and its status, settable per test (read during render).
const bundle = vi.hoisted(() => ({
  isPending: false,
  id: undefined as string | undefined,
  status: undefined as { status: 'success' | 'failure'; receipts?: [] } | undefined,
  reset: vi.fn(),
  onError: undefined as undefined | ((err: Error) => void)
}));

vi.mock('wagmi', () => ({
  useSendCalls: (opts: { mutation: { onError?: (err: Error) => void } }) => {
    bundle.onError = opts.mutation.onError;
    return {
      sendCalls: sendCallsSpy,
      error: null,
      data: bundle.id ? { id: bundle.id } : undefined,
      isPending: bundle.isPending,
      reset: bundle.reset
    };
  },
  useWaitForCallsStatus: () => ({
    isLoading: !!bundle.id && !bundle.status,
    isSuccess: !!bundle.status,
    error: null,
    failureReason: null,
    data: bundle.status
  })
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
  bundle.isPending = false;
  bundle.id = undefined;
  bundle.status = undefined;
  bundle.reset = vi.fn();
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

describe('useSendBatchTransactionFlow — reset while the bundle is out (the modal closed mid-send)', () => {
  const render = (onSuccess = vi.fn(), onError = vi.fn()) =>
    renderHook(() =>
      useSendBatchTransactionFlow({ calls: [], enabled: true, chainId: 1, onSuccess, onError } as never)
    );

  it('clears straight away when nothing is out', () => {
    const onCleared = vi.fn();
    const { result } = render();
    act(() => result.current.reset(onCleared));
    expect(bundle.reset).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('keeps watching a bundle signed after the close until it lands and reports, then clears', () => {
    const onSuccess = vi.fn();
    const onCleared = vi.fn();
    bundle.isPending = true;
    const { result, rerender } = render(onSuccess);
    act(() => result.current.reset(onCleared));
    expect(bundle.reset).not.toHaveBeenCalled();

    bundle.isPending = false;
    bundle.id = '0xbundle';
    rerender();
    expect(onCleared).not.toHaveBeenCalled();

    bundle.status = { status: 'success', receipts: [] };
    rerender();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(bundle.reset).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('is loading while the wallet prompt is open, so no second bundle can overlap it', () => {
    bundle.isPending = true;
    const { result } = render();
    expect(result.current.isLoading).toBe(true);
  });

  it('clears once the wallet rejects a bundle the close left in its prompt', () => {
    const onError = vi.fn();
    const onCleared = vi.fn();
    bundle.isPending = true;
    const { result } = render(vi.fn(), onError);
    act(() => result.current.reset(onCleared));

    act(() => bundle.onError?.(new Error('User rejected the request')));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(bundle.reset).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });
});
