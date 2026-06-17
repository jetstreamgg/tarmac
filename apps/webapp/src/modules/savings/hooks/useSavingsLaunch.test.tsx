/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const USDS_MAINNET = '0xdC035D45d973E3EC169d2276DDab16f1e407384F'.toLowerCase();
const SUSDS_MAINNET = '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD'.toLowerCase();

// Shared mutable state for the module mocks below. `vi.hoisted` runs before the
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
    useChainId: () => 1,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    // The orchestrator + useBatchUpgradeAndSavingsSupply read useAccount (not the
    // exported useConnection); without this it reaches real wagmi → useConfig.
    useAccount: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    useBlockNumber: () => ({ data: 0n })
  };
});

// The orchestrator now calls useSavingsWithdraw unconditionally (hooks rules),
// gated to enabled:false on the supply flow. These stubs keep that disabled
// withdraw hook from reaching real wagmi reads — they do not affect the supply
// calldata seam (useTransactionFlow) the supply tests assert against.
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

// Capture the exact Call[] the engine hands to the transaction flow — this is
// the only channel through which calldata leaves useBatchSavingsSupply, so it is
// precisely "the calls that get signed". The engine itself is left unmodified.
// The orchestrator now also mounts useBatchUpgradeAndSavingsSupply (disabled on
// the USDS path); guard the capture on `enabled` so only the routed engine's
// calls are recorded.
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

// Control the allowance the engine reads (landmine #1 lives inside this hook).
vi.mock('@/hooks/savings/useSavingsAllowance', () => ({
  useSavingsAllowance: () => ({
    data: h.allowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

// DAI -> daiUsds allowance, read by the always-mounted (disabled) upgrade engine
// and the orchestrator's step labels. Irrelevant to the USDS supply path under
// test — a large value keeps the disabled hook quiet.
vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: () => ({
    data: parseUnits('1000000', 18),
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

import { TOKENS, useBatchSavingsSupply } from '@/hooks';
import { useSavingsLaunch } from './useSavingsLaunch';

const AMOUNT = parseUnits('10', 18);
const HAS_ALLOWANCE = parseUnits('1000000', 18);
const REF = 12345;

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
    useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usds, amount, referralCode: ref })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

function captureEngineCalls(amount: bigint, ref?: number): RawCall[] {
  const { unmount } = renderHook(() => useBatchSavingsSupply({ amount, ref, enabled: true }));
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

describe('useSavingsLaunch — mainnet USDS supply calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('routes byte-identical calldata to the engine WITHOUT an existing allowance (approve + deposit)', () => {
    h.allowance = 0n;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    h.allowance = 0n;
    const engine = captureEngineCalls(AMOUNT, REF);

    // Byte-for-byte: target, selector + encoded args, value.
    expect(orch.map(normalize)).toEqual(engine.map(normalize));

    expect(orch).toHaveLength(2);
    expect(normalize(orch[0]).to).toBe(USDS_MAINNET);
    expect(orch[0].functionName).toBe('approve');
    expect((orch[0].args[0] as string).toLowerCase()).toBe(SUSDS_MAINNET);
    expect(orch[0].args[1]).toBe(AMOUNT);

    expect(normalize(orch[1]).to).toBe(SUSDS_MAINNET);
    expect(orch[1].functionName).toBe('deposit');
    expect(orch[1].args).toEqual([AMOUNT, TEST_ADDRESS, REF]);
  });

  it('routes byte-identical calldata to the engine WITH an existing allowance (deposit only)', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    h.allowance = HAS_ALLOWANCE;
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch).toHaveLength(1);
    expect(orch[0].functionName).toBe('deposit');
    expect(normalize(orch[0]).to).toBe(SUSDS_MAINNET);
  });

  it('encodes the referral code as a number (not bigint) in the deposit args', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const deposit = orch[orch.length - 1];
    expect(deposit.functionName).toBe('deposit');
    expect(typeof deposit.args[2]).toBe('number');
    expect(deposit.args[2]).toBe(REF);
  });
});

describe('useSavingsLaunch — landmine #1: approve/allowance derivation stays in the engine', () => {
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
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'deposit']);
    expect(orch.map(c => c.functionName)).toEqual(engine.map(c => c.functionName));
  });
});

describe('useSavingsLaunch — launch() config', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('opens the modal with savings analytics (widgetName/flow/action) on launch()', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usds, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = h.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('savings');
    expect(config.analytics.flow).toBe('supply');
    expect(config.analytics.action).toBe('supply');
  });

  it('routes onConfirm to the engine execute', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usds, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    config.onConfirm();
    expect(h.mockExecute).toHaveBeenCalledTimes(1);
  });

  it('labels approve → supply (2 steps) without allowance, and one step with allowance', () => {
    h.allowance = 0n;
    const a = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usds, amount: AMOUNT, referralCode: REF })
    );
    act(() => a.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].steps).toHaveLength(2);
    a.unmount();
    h.launchMock.mockClear();

    h.allowance = HAS_ALLOWANCE;
    const b = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usds, amount: AMOUNT, referralCode: REF })
    );
    act(() => b.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].steps).toHaveLength(1);
    b.unmount();
  });
});
