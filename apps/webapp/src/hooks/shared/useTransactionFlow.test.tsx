import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, type Call } from 'viem';

const capabilities = vi.hoisted(() => ({
  data: undefined as boolean | undefined,
  isLoading: true
}));

vi.mock('./useIsBatchSupported', () => ({
  useIsBatchSupported: () => capabilities
}));

const sequentialSpy = vi.hoisted(() => vi.fn());
const batchSpy = vi.hoisted(() => vi.fn());

const stubFlow = {
  execute: () => {},
  isLoading: false,
  prepared: false,
  currentCallIndex: 0,
  reset: () => {}
};

vi.mock('./useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (parameters: { enabled: boolean }) => {
    sequentialSpy(parameters);
    return stubFlow;
  }
}));

vi.mock('./useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: (parameters: { enabled: boolean }) => {
    batchSpy(parameters);
    return stubFlow;
  }
}));

import { useTransactionFlow } from './useTransactionFlow';

const call: Call = {
  to: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  abi: erc20Abi,
  functionName: 'approve',
  args: ['0xA188EEC8F81263234dA3622A406892F3D630f98c', 1n]
} as unknown as Call;

/** `enabled` most recently handed to the sequential flow. */
const sequentialEnabled = () => sequentialSpy.mock.lastCall?.[0].enabled;
const batchEnabled = () => batchSpy.mock.lastCall?.[0].enabled;

beforeEach(() => {
  sequentialSpy.mockClear();
  batchSpy.mockClear();
  capabilities.data = undefined;
  capabilities.isLoading = true;
});

afterEach(cleanup);

describe('useTransactionFlow', () => {
  describe('while the wallet capability probe is still in flight', () => {
    // The regression this file exists for: `wallet_getCapabilities` is a wallet round
    // trip, and a single call can only ever go sequentially — so simulating it must not
    // queue behind the probe. It used to, which left every claim modal's Confirm
    // disabled for as long as the wallet took to answer.
    it('simulates a single call immediately', () => {
      renderHook(() => useTransactionFlow({ calls: [call] }));

      expect(sequentialEnabled()).toBe(true);
      expect(batchEnabled()).toBe(false);
    });

    it('simulates immediately when the caller has opted out of bundling', () => {
      renderHook(() => useTransactionFlow({ calls: [call, call], shouldUseBatch: false }));

      expect(sequentialEnabled()).toBe(true);
    });

    it('waits for the answer when bundling could still apply', () => {
      // Here the probe genuinely decides the route, so neither path may start: a
      // sequential simulation would be thrown away the moment the wallet says it bundles.
      renderHook(() => useTransactionFlow({ calls: [call, call] }));

      expect(sequentialEnabled()).toBe(false);
      expect(batchEnabled()).toBe(false);
    });

    it('honours an explicitly disabled flow', () => {
      renderHook(() => useTransactionFlow({ calls: [call], enabled: false }));

      expect(sequentialEnabled()).toBe(false);
    });
  });

  describe('once the probe has answered', () => {
    it('routes multiple calls to the batch flow on a wallet that bundles', () => {
      capabilities.data = true;
      capabilities.isLoading = false;

      const { result } = renderHook(() => useTransactionFlow({ calls: [call, call] }));

      expect(batchEnabled()).toBe(true);
      expect(sequentialEnabled()).toBe(false);
      expect(result.current.isBatch).toBe(true);
    });

    it('keeps a single call sequential even on a wallet that bundles', () => {
      capabilities.data = true;
      capabilities.isLoading = false;

      const { result } = renderHook(() => useTransactionFlow({ calls: [call] }));

      expect(sequentialEnabled()).toBe(true);
      expect(result.current.isBatch).toBe(false);
    });

    it('falls back to sequential when the wallet cannot bundle', () => {
      capabilities.data = false;
      capabilities.isLoading = false;

      renderHook(() => useTransactionFlow({ calls: [call, call] }));

      expect(sequentialEnabled()).toBe(true);
      expect(batchEnabled()).toBe(false);
    });
  });
});
