import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { parseUnits } from 'viem';

const h = vi.hoisted(() => ({
  launchMock: vi.fn(),
  engineParams: undefined as Record<string, unknown> | undefined
}));

vi.mock('wagmi', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useChainId: () => 1
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: h.launchMock,
    isMinimized: false,
    activeSessionId: null,
    restore: vi.fn()
  })
}));

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [true, vi.fn()]
}));

vi.mock('./usePsmConversion', () => ({
  usePsmConversion: (params: Record<string, unknown>) => {
    h.engineParams = params;
    return { direction: params.direction };
  }
}));

vi.mock('../components/ConvertFlow', () => ({ ConvertFlow: () => null }));

import { useConvertLaunch } from './useConvertLaunch';

const AMOUNT_USDS = parseUnits('100', 18);

beforeEach(() => {
  vi.clearAllMocks();
  h.engineParams = undefined;
});

afterEach(cleanup);

describe('useConvertLaunch', () => {
  it('reads the engine for the page without handing it transaction callbacks', () => {
    renderHook(() => useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS }));

    expect(h.engineParams).toMatchObject({
      direction: 'USDS_TO_USDC',
      amount: AMOUNT_USDS,
      shouldUseBatch: true
    });
    expect(h.engineParams).not.toHaveProperty('onMutate');
  });

  it('passes the form gate through to the page engine and defaults it open', () => {
    renderHook(() => useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS, enabled: false }));
    expect(h.engineParams?.enabled).toBe(false);

    renderHook(() => useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS }));
    expect(h.engineParams?.enabled).toBe(true);
  });

  it('launches the review flow at the current amount, guarded to the launch chain', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useConvertLaunch({ direction: 'USDS_TO_USDC', amount: AMOUNT_USDS, onSuccess })
    );

    act(() => result.current.launch());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const options = h.launchMock.mock.calls[0][0];
    // The review is priced for the launch chain, so a wallet-side switch mid-review
    // shows the chain guard (APP-563 #4).
    expect(options.supportedChainIds).toEqual([1]);
    expect(options.chainGuardReason).toBe('launch-chain');
    expect(typeof options.sessionId).toBe('string');
    expect((options.flow as ReactElement).props).toEqual({
      direction: 'USDS_TO_USDC',
      amount: AMOUNT_USDS,
      onSuccess
    });
  });
});
