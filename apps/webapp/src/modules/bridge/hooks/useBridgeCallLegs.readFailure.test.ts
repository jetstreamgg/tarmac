/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, type Call, type PublicClient } from 'viem';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import { useBridgeCallLegs } from './useBridgeCallLegs';

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const CALLS = [
  { to: SENDER, data: '0x01' },
  { to: SENDER, data: '0x02' }
] as Call[];
const RPC_URL = 'https://rpc.example/secret-key';

const mocks = vi.hoisted(() => ({
  sequentialIndex: 0,
  sequentialExecute: vi.fn(),
  reportError: vi.fn()
}));

vi.mock('@/modules/sentry/reportError', () => ({ reportError: mocks.reportError }));
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({
    execute: vi.fn(),
    reset: vi.fn(),
    prepared: false,
    isLoading: false,
    error: null,
    currentCallIndex: 0,
    batchUnavailable: false
  })
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: () => ({
    prepared: true,
    error: null,
    execute: mocks.sequentialExecute,
    reset: vi.fn(),
    currentCallIndex: mocks.sequentialIndex,
    nextCalls: CALLS.slice(mocks.sequentialIndex)
  })
}));

const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

const confirmWithFailedRead = async () => {
  const view = renderHook(() =>
    useBridgeCallLegs({
      calls: CALLS,
      chainId: 8453,
      client: {} as PublicClient,
      from: SENDER,
      sendFunctionName: 'depositForBurn',
      preflight: async () => {
        throw Object.assign(new Error(`HTTP request failed. URL: ${RPC_URL} from ${SENDER}`), {
          name: 'HttpRequestError',
          code: -32005
        });
      },
      getCallbacks: () => callbacks
    })
  );
  await act(async () => view.result.current.execute());
};

describe('useBridgeCallLegs: a pre-send read that fails', () => {
  beforeEach(() => {
    mocks.sequentialIndex = 0;
    mocks.sequentialExecute.mockClear();
    mocks.reportError.mockClear();
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });

  // The modal shows a failure after a mined leg as a rollback unless it is a refusal: nothing was sent.
  it.each([0, 1])('is a send refused, not a rollback, with %i legs mined', async mined => {
    mocks.sequentialIndex = mined;
    await confirmWithFailedRead();

    expect(mocks.sequentialExecute).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    const [error, hash] = callbacks.onError.mock.calls[0];
    expect(hash).toBe('');
    expect(error).toBeInstanceOf(TransactionRefusedError);
    expect((error as TransactionRefusedError).final).toBe(false);
    expect((error as Error).message).not.toContain('rpc.example');
  });

  it('reaches Sentry with its kind and RPC code, never the URL or the account', async () => {
    await confirmWithFailedRead();

    expect(mocks.reportError).toHaveBeenCalledTimes(1);
    const [reported, context] = mocks.reportError.mock.calls[0];
    expect((reported as Error).message).toContain('HttpRequestError');
    expect(context).toMatchObject({ extra: { chainId: 8453, rpcCode: -32005 } });
    const sent = JSON.stringify([(reported as Error).message, (reported as Error).cause ?? null, context]);
    expect(sent).not.toContain('rpc.example');
    expect(sent.toLowerCase()).not.toContain(SENDER.toLowerCase());
  });
});
