/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
// Base — an L2 chain. isL2ChainId(8453) === true routes withdraw to the PSM path.
const BASE = 8453;

// Shared mutable state for the module mocks. `vi.hoisted` runs before the
// `vi.mock` factories so they can close over it.
const h = vi.hoisted(() => ({
  capturedCalls: [] as RawCall[],
  mockExecute: vi.fn(),
  launchMock: vi.fn(),
  allowance: 0n as bigint | undefined
}));

type RawCall = {
  to: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
};

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => BASE,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    useAccount: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    useBlockNumber: () => ({ data: 0n })
  };
});

// Mainnet withdraw engine deps (mounted disabled on L2).
vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: () => undefined })
  };
});

vi.mock('@/hooks/savings/useSavingsData', () => ({
  useSavingsData: () => ({
    data: { userSavingsBalance: 0n, userNstBalance: 0n, savingsRate: 0n, savingsTvl: 0n },
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

vi.mock('@/hooks/savings/useReadSavingsUsds', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/savings/useReadSavingsUsds')>();
  return {
    ...actual,
    useReadSavingsUsdsMaxWithdraw: () => ({ data: undefined, queryKey: ['maxWithdraw'] })
  };
});

vi.mock('@/hooks/shared/useWriteContractFlow', () => ({
  useWriteContractFlow: () => ({
    error: null,
    prepareError: null,
    isLoading: false,
    prepared: false,
    execute: () => undefined,
    data: undefined,
    retryPrepare: () => undefined
  })
}));

// Capture the exact Call[] the routed PSM engine hands to the transaction flow —
// the only channel through which calldata leaves useBatchPsmSwapExactIn /
// useBatchPsmSwapExactOut. The orchestrator mounts six engines; three batch
// engines (mainnet supply, L2 PSM supply, and the routed withdraw engine) share
// this seam, so guard the capture on `enabled` — only the routed engine is enabled.
vi.mock('@/hooks/shared/useTransactionFlow', () => ({
  useTransactionFlow: (params: { calls: RawCall[]; enabled?: boolean }) => {
    if (params.enabled) h.capturedCalls = params.calls;
    return {
      error: null,
      isLoading: false,
      prepared: true,
      execute: h.mockExecute,
      currentCallIndex: 0,
      reset: () => undefined
    };
  }
}));

// Control the allowance every engine reads (landmine #1 lives inside the engine).
vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: () => ({
    data: h.allowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

vi.mock('@/hooks/savings/useSavingsAllowance', () => ({
  useSavingsAllowance: () => ({
    data: 0n,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: h.launchMock,
    updateModalContent: () => undefined,
    isModalOpen: false,
    txCallbacks: {
      onMutate: () => undefined,
      onStart: () => undefined,
      onSuccess: () => undefined,
      onError: () => undefined
    },
    txStatus: 'idle'
  })
}));

// The orchestrator now derives shouldUseBatch from the batch toggle + wallet
// capability; stub both (the batch decision itself is covered by
// useSavingsLaunch.batch.test.tsx — these calldata/config tests don't assert it).
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [false, () => undefined]
}));
vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({ data: false })
}));

import { TOKENS, useBatchPsmSwapExactIn, useBatchPsmSwapExactOut, psm3L2Address } from '@/hooks';
import { useSavingsLaunch } from './useSavingsLaunch';

// Specific-amount withdraw: the user wants AMOUNT_OUT of the origin token out.
const AMOUNT_OUT = parseUnits('10', 18);
// swapExactOut caps the sUSDS in needed to satisfy AMOUNT_OUT.
const MAX_AMOUNT_IN = parseUnits('10.1', 18);
// Max withdraw: the whole sUSDS balance is swapped out…
const SUSDS_BALANCE = parseUnits('123.456', 18);
// …with a minimum origin token out (slippage floor).
const MIN_OUT_FOR_ALL = parseUnits('122', 18);
const HAS_ALLOWANCE = parseUnits('1000000', 18);
const REF = 12345;

const SUSDS = TOKENS.susds.address[BASE].toLowerCase();
const ORIGIN = TOKENS.usds.address[BASE].toLowerCase();
const PSM = psm3L2Address[BASE].toLowerCase();

function normalize(call: RawCall) {
  return {
    to: call.to.toLowerCase(),
    data: encodeFunctionData({
      abi: call.abi as Parameters<typeof encodeFunctionData>[0]['abi'],
      functionName: call.functionName,
      args: call.args
    }),
    value: call.value ?? undefined
  };
}

// --- max withdraw (swapExactIn, sUSDS → origin) -----------------------------

function captureMaxWithdrawOrchestrator(ref?: number): RawCall[] {
  const { unmount } = renderHook(() =>
    useSavingsLaunch({
      flow: 'withdraw',
      originToken: TOKENS.usds,
      amount: AMOUNT_OUT, // cosmetic for max — engine swaps the whole sUSDS balance
      max: true,
      referralCode: ref,
      sUsdsBalance: SUSDS_BALANCE,
      minAmountOutForWithdrawAll: MIN_OUT_FOR_ALL
    })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

function captureMaxWithdrawEngine(ref?: number): RawCall[] {
  const { unmount } = renderHook(() =>
    useBatchPsmSwapExactIn({
      assetIn: TOKENS.susds.address[BASE],
      assetOut: TOKENS.usds.address[BASE],
      amountIn: SUSDS_BALANCE,
      minAmountOut: MIN_OUT_FOR_ALL,
      referralCode: ref ? BigInt(ref) : undefined,
      enabled: true
    })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

// --- specific-amount withdraw (swapExactOut, sUSDS → origin) ----------------

function captureWithdrawOrchestrator(ref?: number): RawCall[] {
  const { unmount } = renderHook(() =>
    useSavingsLaunch({
      flow: 'withdraw',
      originToken: TOKENS.usds,
      amount: AMOUNT_OUT,
      max: false,
      referralCode: ref,
      maxAmountInForWithdraw: MAX_AMOUNT_IN
    })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

function captureWithdrawEngine(ref?: number): RawCall[] {
  const { unmount } = renderHook(() =>
    useBatchPsmSwapExactOut({
      assetIn: TOKENS.susds.address[BASE],
      assetOut: TOKENS.usds.address[BASE],
      amountOut: AMOUNT_OUT,
      maxAmountIn: MAX_AMOUNT_IN,
      referralCode: ref ? BigInt(ref) : undefined,
      enabled: true
    })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

describe('useSavingsLaunch — L2 PSM withdraw calldata parity (max → swapExactIn)', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('routes byte-identical calldata to the engine WITHOUT an existing allowance (approve + swapExactIn)', () => {
    h.allowance = 0n;
    const orch = captureMaxWithdrawOrchestrator(REF);
    h.allowance = 0n;
    const engine = captureMaxWithdrawEngine(REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));

    expect(orch).toHaveLength(2);
    // approve targets sUSDS (the assetIn for a withdraw), spender psm3L2.
    expect(normalize(orch[0]).to).toBe(SUSDS);
    expect(orch[0].functionName).toBe('approve');
    expect((orch[0].args[0] as string).toLowerCase()).toBe(PSM);
    expect(orch[0].args[1]).toBe(SUSDS_BALANCE);

    expect(normalize(orch[1]).to).toBe(PSM);
    expect(orch[1].functionName).toBe('swapExactIn');
    expect((orch[1].args[0] as string).toLowerCase()).toBe(SUSDS);
    expect((orch[1].args[1] as string).toLowerCase()).toBe(ORIGIN);
    expect(orch[1].args[2]).toBe(SUSDS_BALANCE);
    expect(orch[1].args[3]).toBe(MIN_OUT_FOR_ALL);
    expect(orch[1].args[4]).toBe(TEST_ADDRESS);
  });

  it('routes byte-identical calldata WITH an existing allowance (swapExactIn only)', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureMaxWithdrawOrchestrator(REF);
    h.allowance = HAS_ALLOWANCE;
    const engine = captureMaxWithdrawEngine(REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch).toHaveLength(1);
    expect(orch[0].functionName).toBe('swapExactIn');
    expect(normalize(orch[0]).to).toBe(PSM);
  });

  it('encodes the referral code as a bigint in the swapExactIn args', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureMaxWithdrawOrchestrator(REF);
    const swap = orch[orch.length - 1];
    expect(swap.functionName).toBe('swapExactIn');
    expect(typeof swap.args[5]).toBe('bigint');
    expect(swap.args[5]).toBe(BigInt(REF));
  });
});

describe('useSavingsLaunch — L2 PSM withdraw calldata parity (specific → swapExactOut)', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('routes byte-identical calldata to the engine WITHOUT an existing allowance (approve + swapExactOut)', () => {
    h.allowance = 0n;
    const orch = captureWithdrawOrchestrator(REF);
    h.allowance = 0n;
    const engine = captureWithdrawEngine(REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));

    expect(orch).toHaveLength(2);
    // approve targets sUSDS (the assetIn), approving the max-in ceiling.
    expect(normalize(orch[0]).to).toBe(SUSDS);
    expect(orch[0].functionName).toBe('approve');
    expect((orch[0].args[0] as string).toLowerCase()).toBe(PSM);
    expect(orch[0].args[1]).toBe(MAX_AMOUNT_IN);

    expect(normalize(orch[1]).to).toBe(PSM);
    expect(orch[1].functionName).toBe('swapExactOut');
    expect((orch[1].args[0] as string).toLowerCase()).toBe(SUSDS);
    expect((orch[1].args[1] as string).toLowerCase()).toBe(ORIGIN);
    expect(orch[1].args[2]).toBe(AMOUNT_OUT);
    expect(orch[1].args[3]).toBe(MAX_AMOUNT_IN);
    expect(orch[1].args[4]).toBe(TEST_ADDRESS);
  });

  it('routes byte-identical calldata WITH an existing allowance (swapExactOut only)', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureWithdrawOrchestrator(REF);
    h.allowance = HAS_ALLOWANCE;
    const engine = captureWithdrawEngine(REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch).toHaveLength(1);
    expect(orch[0].functionName).toBe('swapExactOut');
    expect(normalize(orch[0]).to).toBe(PSM);
  });

  it('encodes the referral code as a bigint in the swapExactOut args', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureWithdrawOrchestrator(REF);
    const swap = orch[orch.length - 1];
    expect(swap.functionName).toBe('swapExactOut');
    expect(typeof swap.args[5]).toBe('bigint');
    expect(swap.args[5]).toBe(BigInt(REF));
  });
});

describe('useSavingsLaunch — L2 withdraw landmine #1: approve/allowance derivation stays in the PSM engine', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('does NOT inject an approve call when the engine reports a sufficient allowance (max)', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureMaxWithdrawOrchestrator(REF);
    expect(orch).toHaveLength(1);
    expect(orch.some(c => c.functionName === 'approve')).toBe(false);
  });

  it('does NOT inject an approve call when the engine reports a sufficient allowance (specific)', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureWithdrawOrchestrator(REF);
    expect(orch).toHaveLength(1);
    expect(orch.some(c => c.functionName === 'approve')).toBe(false);
  });

  it('includes the approve only because the engine derived it, in the engine ordering (specific)', () => {
    h.allowance = 0n;
    const orch = captureWithdrawOrchestrator(REF);
    const engine = captureWithdrawEngine(REF);
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'swapExactOut']);
    expect(orch.map(c => c.functionName)).toEqual(engine.map(c => c.functionName));
  });
});

describe('useSavingsLaunch — L2 withdraw launch() config', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('opens the modal with savings withdraw analytics (widgetName/flow/action)', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({
        flow: 'withdraw',
        originToken: TOKENS.usds,
        amount: AMOUNT_OUT,
        max: false,
        referralCode: REF,
        maxAmountInForWithdraw: MAX_AMOUNT_IN
      })
    );
    act(() => result.current.launch());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = h.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('savings');
    expect(config.analytics.flow).toBe('withdraw');
    expect(config.analytics.action).toBe('withdraw');
  });

  it('routes onConfirm to the routed PSM withdraw engine (specific → swapExactOut engine)', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({
        flow: 'withdraw',
        originToken: TOKENS.usds,
        amount: AMOUNT_OUT,
        max: false,
        referralCode: REF,
        maxAmountInForWithdraw: MAX_AMOUNT_IN
      })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    config.onConfirm();
    expect(h.mockExecute).toHaveBeenCalledTimes(1);
  });

  it('labels approve → withdraw (2 steps) without allowance, and one step with allowance', () => {
    h.allowance = 0n;
    const a = renderHook(() =>
      useSavingsLaunch({
        flow: 'withdraw',
        originToken: TOKENS.usds,
        amount: AMOUNT_OUT,
        max: false,
        referralCode: REF,
        maxAmountInForWithdraw: MAX_AMOUNT_IN
      })
    );
    act(() => a.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].steps).toHaveLength(2);
    a.unmount();
    h.launchMock.mockClear();

    h.allowance = HAS_ALLOWANCE;
    const b = renderHook(() =>
      useSavingsLaunch({
        flow: 'withdraw',
        originToken: TOKENS.usds,
        amount: AMOUNT_OUT,
        max: false,
        referralCode: REF,
        maxAmountInForWithdraw: MAX_AMOUNT_IN
      })
    );
    act(() => b.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].steps).toHaveLength(1);
    b.unmount();
  });
});
