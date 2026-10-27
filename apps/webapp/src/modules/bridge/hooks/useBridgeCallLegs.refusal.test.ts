/**
 * @vitest-environment happy-dom
 */
// A send the preflight refuses reaches the modal as a refusal written for the user.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, type Call, type PublicClient } from 'viem';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import { useBridgeCallLegs } from './useBridgeCallLegs';

const execute = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({
    execute: vi.fn(),
    reset: vi.fn(),
    prepared: false,
    isLoading: false,
    error: null,
    currentCallIndex: 0,
    batchUnavailable: true
  })
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: () => ({ prepared: true, error: null, execute, reset: vi.fn() })
}));

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const CALLS = [{ to: SENDER, data: '0x01' }] as Call[];
const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

async function confirmWith(preflight: () => Promise<Error | undefined>) {
  const { result } = renderHook(() =>
    useBridgeCallLegs({
      calls: CALLS,
      chainId: 8453,
      client: {} as PublicClient,
      from: SENDER,
      sendFunctionName: 'depositForBurn',
      preflight,
      getCallbacks: () => callbacks
    })
  );
  await act(async () => result.current.execute());
}

describe('useBridgeCallLegs preflight refusal', () => {
  beforeEach(() => {
    execute.mockClear();
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });

  it.each([
    { refusal: new Error('CCTP is paused.'), final: false },
    { refusal: new TransactionRefusedError('This bridge was already sent.', { final: true }), final: true }
  ])(
    'reports "$refusal.message" hashless, with its message and finality, and sends nothing',
    async ({ refusal, final }) => {
      await confirmWith(async () => refusal);
      expect(execute).not.toHaveBeenCalled();
      expect(callbacks.onMutate).not.toHaveBeenCalled();
      expect(callbacks.onError).toHaveBeenCalledTimes(1);
      const [error, hash] = callbacks.onError.mock.calls[0];
      expect(error).toBeInstanceOf(TransactionRefusedError);
      expect(error).toMatchObject({ message: refusal.message, final });
      expect(hash).toBe('');
    }
  );

  it('refuses a failed read with the modal copy, not its raw message', async () => {
    await confirmWith(async () => {
      throw new Error('HTTP request failed. URL: https://rpc.example');
    });
    expect(execute).not.toHaveBeenCalled();
    const [error] = callbacks.onError.mock.calls[0];
    expect(error).toBeInstanceOf(TransactionRefusedError);
    expect(error).toMatchObject({ message: 'The transaction could not be sent.', final: false });
  });
});
