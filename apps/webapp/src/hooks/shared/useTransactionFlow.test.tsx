import { act, renderHook, cleanup } from '@testing-library/react';
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

/** What the batch flow reports about its chain's RPC (see `batchUnavailable`). */
const batchFlow = vi.hoisted(() => ({ batchUnavailable: false }));
/** The step the sequential flow has reached (> 0 once a step has mined). */
const sequentialFlow = vi.hoisted(() => ({ currentCallIndex: 0 }));

vi.mock('./useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (parameters: { enabled: boolean }) => {
    sequentialSpy(parameters);
    return { ...stubFlow, currentCallIndex: sequentialFlow.currentCallIndex };
  }
}));

vi.mock('./useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: (parameters: { enabled: boolean; simulateEnabled: boolean }) => {
    batchSpy(parameters);
    return { ...stubFlow, batchUnavailable: batchFlow.batchUnavailable };
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
const batchSimulateEnabled = () => batchSpy.mock.lastCall?.[0].simulateEnabled;
const sendBatch = () => batchSpy.mock.lastCall?.[0].onMutate();
const sendSequential = () => sequentialSpy.mock.lastCall?.[0].onMutate();
const failSequential = () => sequentialSpy.mock.lastCall?.[0].onError(new Error('rejected'), '');
const failBatch = () => batchSpy.mock.lastCall?.[0].onError(new Error('rejected'), undefined);
const succeedBatch = () => batchSpy.mock.lastCall?.[0].onSuccess('0xhash');

beforeEach(() => {
  sequentialSpy.mockClear();
  batchSpy.mockClear();
  capabilities.data = undefined;
  capabilities.isLoading = true;
  batchFlow.batchUnavailable = false;
  sequentialFlow.currentCallIndex = 0;
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

    it('starts the batch simulation without waiting for the probe', () => {
      // The simulation is an RPC round trip of its own; serialising it behind the wallet
      // probe would be the claim-modal latency all over again, on the batch side.
      renderHook(() => useTransactionFlow({ calls: [call, call] }));

      expect(batchSimulateEnabled()).toBe(true);
    });

    it('does not simulate a bundle for a single call', () => {
      renderHook(() => useTransactionFlow({ calls: [call] }));

      expect(batchSimulateEnabled()).toBe(false);
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
      // …and stops simulating a bundle that will never be sent.
      expect(batchSimulateEnabled()).toBe(false);
    });

    it('stops simulating a bundle for a wallet that never answered yes', () => {
      // A wallet without EIP-5792 rejects the capability probe, which settles as
      // "unknown" rather than "no" — the bundle it can never send must not simulate.
      capabilities.data = undefined;
      capabilities.isLoading = false;

      renderHook(() => useTransactionFlow({ calls: [call, call] }));

      expect(batchSimulateEnabled()).toBe(false);
      expect(sequentialEnabled()).toBe(true);
    });

    it('falls back to sequential when the RPC cannot simulate a bundle', () => {
      // The wallet bundles, but this chain's RPC rejects the state override the batch
      // simulation needs. Fail-closed there would leave Confirm disabled forever; the
      // sequential path still validates every call, at the cost of N signatures.
      capabilities.data = true;
      capabilities.isLoading = false;
      batchFlow.batchUnavailable = true;

      const { result } = renderHook(() => useTransactionFlow({ calls: [call, call] }));

      expect(sequentialEnabled()).toBe(true);
      expect(result.current.isBatch).toBe(false);
    });
    it('keeps calls the sequential flow cannot simulate on the batch route, failed closed', () => {
      // Stake's bundled legs are raw `{ to, data }` calls: the sequential flow needs an
      // abi and a function name per call, so it would stall after the approve.
      capabilities.data = true;
      capabilities.isLoading = false;
      batchFlow.batchUnavailable = true;
      const raw = { to: call.to, data: '0x12345678' } as Call;

      const { result } = renderHook(() => useTransactionFlow({ calls: [call, raw] }));

      expect(result.current.isBatch).toBe(true);
      expect(sequentialEnabled()).toBe(false);
    });
  });

  describe('while a send is in flight', () => {
    beforeEach(() => {
      capabilities.data = true;
      capabilities.isLoading = false;
    });

    it('keeps a sequential send sequential when a fresh batch simulation has no verdict yet', () => {
      // A chain whose RPC can't simulate a bundle: sequential until the next change of
      // calls starts a new batch simulation, which reads as "batch" until it fails too.
      batchFlow.batchUnavailable = true;
      const { result, rerender } = renderHook(() => useTransactionFlow({ calls: [call, call] }));
      act(() => sendSequential());

      batchFlow.batchUnavailable = false;
      rerender();

      expect(result.current.isBatch).toBe(false);
      expect(sequentialEnabled()).toBe(true);
      expect(batchSimulateEnabled()).toBe(false);
    });

    it('keeps a batch send on the batch route until it settles', () => {
      const { result, rerender } = renderHook(() => useTransactionFlow({ calls: [call, call] }));
      act(() => sendBatch());

      batchFlow.batchUnavailable = true;
      rerender();
      expect(result.current.isBatch).toBe(true);

      act(() => failBatch());
      expect(result.current.isBatch).toBe(false);
    });

    it('stops simulating the bundle while it is out', () => {
      // A focus refetch would run against the state the send itself changes.
      renderHook(() => useTransactionFlow({ calls: [call, call] }));
      expect(batchSimulateEnabled()).toBe(true);
      act(() => sendBatch());
      expect(batchSimulateEnabled()).toBe(false);
    });

    it('lets go of a batch route once the calls no longer bundle', () => {
      // A page-hosted form whose wallet prompt was abandoned without an answer: the next
      // amount needs a single call, and a held batch route would disable both flows.
      const { result, rerender } = renderHook(({ calls }) => useTransactionFlow({ calls }), {
        initialProps: { calls: [call, call] }
      });
      act(() => sendBatch());

      rerender({ calls: [call] });
      expect(result.current.isBatch).toBe(false);
      expect(sequentialEnabled()).toBe(true);
    });

    it('releases the route once the send succeeds', () => {
      const { result, rerender } = renderHook(() => useTransactionFlow({ calls: [call, call] }));
      act(() => sendBatch());
      act(() => succeedBatch());

      batchFlow.batchUnavailable = true;
      rerender();
      expect(result.current.isBatch).toBe(false);
    });

    it('releases a sequential route rejected before anything mined', () => {
      batchFlow.batchUnavailable = true;
      const { result, rerender } = renderHook(() => useTransactionFlow({ calls: [call, call] }));
      act(() => sendSequential());
      act(() => failSequential());

      batchFlow.batchUnavailable = false;
      rerender();
      expect(result.current.isBatch).toBe(true);
    });

    it('holds a sequential route rejected mid-run, so the resume stays sequential', () => {
      batchFlow.batchUnavailable = true;
      const { result, rerender } = renderHook(() => useTransactionFlow({ calls: [call, call] }));
      act(() => sendSequential());

      // The first step mined; the wallet then rejects the second.
      sequentialFlow.currentCallIndex = 1;
      rerender();
      act(() => failSequential());

      batchFlow.batchUnavailable = false;
      rerender();
      expect(result.current.isBatch).toBe(false);
      expect(sequentialEnabled()).toBe(true);
    });

    it('holds nothing when execute() bails before reaching the wallet', () => {
      // A flow that refuses early (not prepared, not enabled) never calls onMutate, so no
      // route is held and the live route keeps following the flows.
      const { result, rerender } = renderHook(() => useTransactionFlow({ calls: [call, call] }));
      act(() => result.current.execute());

      batchFlow.batchUnavailable = true;
      rerender();
      expect(result.current.isBatch).toBe(false);
    });

    it("follows the caller's gate mid-run", () => {
      // The caller's gate carries safety checks of its own (the USDC supply's PSM fee
      // gate); a form that must stay armed through a run relaxes its amount check
      // before it reaches here (useTransactionRunActive), never the whole gate.
      batchFlow.batchUnavailable = true;
      const { rerender } = renderHook(({ enabled }) => useTransactionFlow({ calls: [call, call], enabled }), {
        initialProps: { enabled: true }
      });
      act(() => sendSequential());

      rerender({ enabled: false });
      expect(sequentialEnabled()).toBe(false);
    });
  });
});
