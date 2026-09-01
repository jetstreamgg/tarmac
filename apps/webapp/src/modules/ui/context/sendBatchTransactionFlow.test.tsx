import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, type Call } from 'viem';

// The cross-chain-calldata backstop (APP-528): a batch is sent WITHOUT
// per-call simulation, so the shared batch flow itself must refuse a batch
// whose target address resolved to `undefined` — the shape a
// `Record<chainId, address>` takes when read on a chain the product isn't on.
// This is the last line of defense behind the modal's chain guard.

const sendCallsSpy = vi.hoisted(() => vi.fn());
const capabilities = vi.hoisted(() => ({ data: true as boolean | undefined, isLoading: false }));

vi.mock('wagmi', () => ({
  useSendCalls: () => ({
    sendCalls: sendCallsSpy,
    error: null,
    data: undefined,
    reset: vi.fn()
  }),
  useWaitForCallsStatus: () => ({
    isLoading: false,
    isSuccess: false,
    error: null,
    failureReason: null,
    data: undefined
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
