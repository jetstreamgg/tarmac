/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { keepPreviousData } from '@tanstack/react-query';
import { parseUnits } from 'viem';

vi.mock('wagmi', () => ({
  useChainId: () => 1
}));

vi.mock('./useReadStUsdsImplementation', () => ({
  useReadStUsdsImplementation: vi.fn()
}));

import { useReadStUsdsImplementation } from './useReadStUsdsImplementation';
import { useStUsdsPreviewWithdraw } from './useStUsdsPreviewWithdraw';

const mockRead = useReadStUsdsImplementation as unknown as ReturnType<typeof vi.fn>;

describe('useStUsdsPreviewWithdraw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockReturnValue({
      data: parseUnits('95', 18),
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });
  });

  it('keeps the previous preview across an amount re-key (no isLoading pulse on live-max drift)', () => {
    // The stUSDS form derives a Max withdraw amount from the live max, which
    // drifts ~15s on a Curve-backed withdraw; each drift re-keys this read.
    // Without a placeholder, every re-key drops `data` and pulses `isLoading`
    // for a round trip — greying out Confirm from the review screen (APP-507).
    renderHook(() => useStUsdsPreviewWithdraw(parseUnits('100', 18)));

    expect(mockRead).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ placeholderData: keepPreviousData })
      })
    );
  });

  it('disables the read at a zero amount', () => {
    renderHook(() => useStUsdsPreviewWithdraw(0n));

    expect(mockRead).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ enabled: false })
      })
    );
  });
});
