/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStUsdsWithdraw } from './useStUsdsWithdraw';

vi.mock('wagmi', () => ({
  useConnection: vi.fn(),
  useChainId: vi.fn()
}));

vi.mock('./useStUsdsData', () => ({
  useStUsdsData: vi.fn()
}));

vi.mock('../shared/useWriteContractFlow', () => ({
  useWriteContractFlow: vi.fn()
}));

import { useConnection, useChainId } from 'wagmi';
import { useStUsdsData } from './useStUsdsData';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

describe('useStUsdsWithdraw', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useConnection as ReturnType<typeof vi.fn>).mockReturnValue({
      address: '0x0000000000000000000000000000000000000001',
      isConnected: true
    });

    (useChainId as ReturnType<typeof vi.fn>).mockReturnValue(1);

    (useWriteContractFlow as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      execute: vi.fn(),
      retryPrepare: vi.fn(),
      prepareError: null,
      prepared: false
    });
  });

  it('disables max withdraw when buffered liquidity is below full-share assets', () => {
    (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        userStUsdsBalance: 10n,
        userSuppliedUsds: 100n,
        userMaxWithdrawBuffered: 50n
      }
    });

    renderHook(() =>
      useStUsdsWithdraw({
        amount: 50n,
        max: true,
        enabled: true
      })
    );

    const calls = (useWriteContractFlow as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1]?.[0];
    expect(lastCall?.enabled).toBe(false);
  });

  it('enables max withdraw when buffered liquidity covers full-share assets', () => {
    (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        userStUsdsBalance: 10n,
        userSuppliedUsds: 100n,
        userMaxWithdrawBuffered: 150n
      }
    });

    renderHook(() =>
      useStUsdsWithdraw({
        amount: 100n,
        max: true,
        enabled: true
      })
    );

    const calls = (useWriteContractFlow as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1]?.[0];
    expect(lastCall?.enabled).toBe(true);
  });
});
