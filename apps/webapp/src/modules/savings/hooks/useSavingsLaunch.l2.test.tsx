/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
// Base — an L2 chain. isL2ChainId(8453) === true routes supply to the PSM path.
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
    // The orchestrator + mainnet engines read useAccount (not the exported
    // useConnection); without this it reaches real wagmi → useConfig.
    useAccount: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    useBlockNumber: () => ({ data: 0n })
  };
});

// Withdraw engine deps (mounted disabled on the supply flow).
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

// Capture the exact Call[] the engine hands to the transaction flow — the only
// channel through which calldata leaves useBatchPsmSwapExactIn (same seam as the
// mainnet batch supply engine). The orchestrator also mounts the mainnet supply +
// upgrade engines (disabled on L2); guard the capture on `enabled` so only the
// routed PSM engine's calls are recorded.
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

// Control the allowance the PSM engine reads (landmine #1 lives inside the engine).
// All useTokenAllowance reads (PSM assetIn, plus the orchestrator's mainnet-only DAI
// read which is disabled on L2) resolve to this value.
vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: () => ({
    data: h.allowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

// USDS→sUSDS allowance, read by the always-mounted (disabled) mainnet supply engine
// and the orchestrator's mainnet step labels. Irrelevant to the L2 PSM path.
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

import { TOKENS, useBatchPsmSwapExactIn, psm3L2Address } from '@/hooks';
import { useSavingsLaunch } from './useSavingsLaunch';

const AMOUNT = parseUnits('10', 18);
const MIN_OUT = parseUnits('9.9', 18);
const HAS_ALLOWANCE = parseUnits('1000000', 18);
const REF = 12345;

const ASSET_IN = TOKENS.usds.address[BASE].toLowerCase();
const ASSET_OUT = TOKENS.susds.address[BASE].toLowerCase();
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

function captureOrchestratorCalls(amount: bigint, ref?: number): RawCall[] {
  const { unmount } = renderHook(() =>
    useSavingsLaunch({
      flow: 'supply',
      originToken: TOKENS.usds,
      amount,
      minAmountOut: MIN_OUT,
      referralCode: ref
    })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

function captureEngineCalls(amount: bigint, ref?: number): RawCall[] {
  const { unmount } = renderHook(() =>
    useBatchPsmSwapExactIn({
      assetIn: TOKENS.usds.address[BASE],
      assetOut: TOKENS.susds.address[BASE],
      amountIn: amount,
      minAmountOut: MIN_OUT,
      referralCode: ref ? BigInt(ref) : undefined,
      enabled: true
    })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

describe('useSavingsLaunch — L2 PSM supply calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('routes byte-identical calldata to the engine WITHOUT an existing allowance (approve + swapExactIn)', () => {
    h.allowance = 0n;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    h.allowance = 0n;
    const engine = captureEngineCalls(AMOUNT, REF);

    // Byte-for-byte: target, selector + encoded args, value.
    expect(orch.map(normalize)).toEqual(engine.map(normalize));

    expect(orch).toHaveLength(2);
    expect(normalize(orch[0]).to).toBe(ASSET_IN);
    expect(orch[0].functionName).toBe('approve');
    expect((orch[0].args[0] as string).toLowerCase()).toBe(PSM);
    expect(orch[0].args[1]).toBe(AMOUNT);

    expect(normalize(orch[1]).to).toBe(PSM);
    expect(orch[1].functionName).toBe('swapExactIn');
    expect((orch[1].args[0] as string).toLowerCase()).toBe(ASSET_IN);
    expect((orch[1].args[1] as string).toLowerCase()).toBe(ASSET_OUT);
    expect(orch[1].args[2]).toBe(AMOUNT);
    expect(orch[1].args[3]).toBe(MIN_OUT);
    expect(orch[1].args[4]).toBe(TEST_ADDRESS);
  });

  it('routes byte-identical calldata to the engine WITH an existing allowance (swapExactIn only)', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    h.allowance = HAS_ALLOWANCE;
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch).toHaveLength(1);
    expect(orch[0].functionName).toBe('swapExactIn');
    expect(normalize(orch[0]).to).toBe(PSM);
  });

  it('encodes the referral code as a bigint (not number) in the swapExactIn args', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const swap = orch[orch.length - 1];
    expect(swap.functionName).toBe('swapExactIn');
    expect(typeof swap.args[5]).toBe('bigint');
    expect(swap.args[5]).toBe(BigInt(REF));
  });
});

describe('useSavingsLaunch — L2 landmine #1: approve/allowance derivation stays in the PSM engine', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('does NOT inject an approve call when the engine reports a sufficient allowance', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    expect(orch).toHaveLength(1);
    expect(orch.some(c => c.functionName === 'approve')).toBe(false);
  });

  it('includes the approve call only because the engine derived it, in the engine ordering', () => {
    h.allowance = 0n;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const engine = captureEngineCalls(AMOUNT, REF);
    // The orchestrator never constructs, reorders, or re-derives approve calls —
    // presence and ordering match the engine exactly.
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'swapExactIn']);
    expect(orch.map(c => c.functionName)).toEqual(engine.map(c => c.functionName));
  });
});

describe('useSavingsLaunch — L2 supply launch() config', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('opens the modal with savings analytics (widgetName/flow/action) on launch()', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({
        flow: 'supply',
        originToken: TOKENS.usds,
        amount: AMOUNT,
        minAmountOut: MIN_OUT,
        referralCode: REF
      })
    );
    act(() => result.current.launch());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = h.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('savings');
    expect(config.analytics.flow).toBe('supply');
    expect(config.analytics.action).toBe('supply');
  });

  it('routes onConfirm to the PSM engine execute', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({
        flow: 'supply',
        originToken: TOKENS.usds,
        amount: AMOUNT,
        minAmountOut: MIN_OUT,
        referralCode: REF
      })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    config.onConfirm();
    expect(h.mockExecute).toHaveBeenCalledTimes(1);
  });

  it('keeps the L2 supply steps generic ("Approve" / "Supply") — Figma is mainnet-only', () => {
    h.allowance = 0n;
    const a = renderHook(() =>
      useSavingsLaunch({
        flow: 'supply',
        originToken: TOKENS.usds,
        amount: AMOUNT,
        minAmountOut: MIN_OUT,
        referralCode: REF
      })
    );
    act(() => a.result.current.launch());
    // L2 has no Figma frame; the labels intentionally stay token-agnostic.
    expect(h.launchMock.mock.calls[0][0].steps).toEqual(['Approve', 'Supply']);
    a.unmount();
    h.launchMock.mockClear();

    h.allowance = HAS_ALLOWANCE;
    const b = renderHook(() =>
      useSavingsLaunch({
        flow: 'supply',
        originToken: TOKENS.usds,
        amount: AMOUNT,
        minAmountOut: MIN_OUT,
        referralCode: REF
      })
    );
    act(() => b.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].steps).toEqual(['Supply']);
    b.unmount();
  });
});
