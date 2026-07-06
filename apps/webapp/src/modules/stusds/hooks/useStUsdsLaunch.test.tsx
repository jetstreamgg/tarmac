/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

// Shared mutable state for the module mocks below. `vi.hoisted` runs before the
// `vi.mock` factories so they can close over it.
const h = vi.hoisted(() => ({
  capturedCalls: [] as RawCall[],
  capturedWrite: null as CapturedWrite | null,
  nativeAllowance: 0n as bigint | undefined,
  curveHasAllowance: { USDS: false, stUSDS: false } as Record<string, boolean>
}));

type RawCall = {
  to: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
};

type CapturedWrite = {
  address: `0x${string}`;
  functionName: string;
  args: readonly unknown[];
  enabled: boolean;
};

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    useAccount: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    useBlockNumber: () => ({ data: 0n })
  };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: () => undefined })
  };
});

// Capture the exact Call[] the engines hand to the transaction flow — the only
// channel through which batch calldata leaves useBatchStUsdsDeposit /
// useBatchCurveSwap, so it is precisely "the calls that get signed". Both the
// orchestrator and the bare engines mount several flow hooks (hooks rules);
// guard the capture on `enabled` so only the routed engine's calls land.
vi.mock('@/hooks/shared/useTransactionFlow', () => ({
  useTransactionFlow: (params: { calls: RawCall[]; enabled?: boolean }) => {
    if (params.enabled) h.capturedCalls = params.calls;
    return {
      error: null,
      isLoading: false,
      prepared: true,
      execute: () => undefined,
      currentCallIndex: 0,
      reset: () => undefined
    };
  }
}));

// The native withdraw is a plain write — capture its params at the
// useWriteContractFlow seam (the D6 pattern for non-batch engines).
vi.mock('@/hooks/shared/useWriteContractFlow', () => ({
  useWriteContractFlow: (params: CapturedWrite) => {
    if (params.enabled) h.capturedWrite = params;
    return {
      error: null,
      prepareError: null,
      isLoading: false,
      prepared: !!params.enabled,
      execute: () => undefined,
      data: undefined,
      retryPrepare: () => undefined
    };
  }
}));

// Control the allowances the engines read; the calls they derive from them are
// the thing under test.
vi.mock('@/hooks/stusds/useStUsdsAllowance', () => ({
  useStUsdsAllowance: () => ({
    data: h.nativeAllowance,
    error: null,
    isLoading: false,
    mutate: () => undefined
  })
}));
vi.mock('@/hooks/stusds/providers/useCurveAllowance', () => ({
  useCurveAllowance: ({ token }: { token: 'USDS' | 'stUSDS' }) => ({
    data: h.curveHasAllowance[token] ? parseUnits('1000000', 18) : 0n,
    hasAllowance: h.curveHasAllowance[token],
    error: null,
    isLoading: false,
    mutate: () => undefined
  })
}));

// Pool token ordering for the Curve exchange args.
vi.mock('@/hooks/stusds/providers/useCurvePoolData', () => ({
  useCurvePoolData: () => ({
    data: { tokenIndices: { usds: 0, stUsds: 1 } },
    isLoading: false,
    error: null
  })
}));

// The native withdraw engine reads position data to route withdraw vs redeem.
vi.mock('@/hooks/stusds/useStUsdsData', () => ({
  useStUsdsData: () => ({
    data: {
      userStUsdsBalance: parseUnits('42', 18),
      userSuppliedUsds: parseUnits('50', 18),
      userMaxWithdrawBuffered: parseUnits('1000000', 18)
    },
    error: null,
    isLoading: false,
    mutate: () => undefined
  })
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: () => undefined,
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

// The batch decision itself isn't under test here.
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [false, () => undefined]
}));
vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({ data: false })
}));

import { StUsdsDirection, StUsdsProviderType, useBatchCurveSwap, useBatchStUsdsDeposit } from '@/hooks';
import { calculateMinOutputWithSlippage } from '@/hooks/stusds/providers/rateComparison';
import { STUSDS_PROVIDER_CONFIG } from '@/hooks/stusds/providers/constants';
import { REFERRAL_CODE } from '@/lib/constants';
import { useStUsdsLaunch, type StUsdsEngineParams } from './useStUsdsLaunch';

const AMOUNT = parseUnits('10', 18);
const HAS_ALLOWANCE = parseUnits('1000000', 18);
// Quoted outputs (stUSDS on supply, USDS on withdraw) — arbitrary but distinct.
const SUPPLY_QUOTE_OUT = parseUnits('9.5', 18);
const WITHDRAW_STUSDS_IN = parseUnits('10.6', 18);

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

function captureOrchestratorCalls(params: StUsdsEngineParams): RawCall[] {
  h.capturedCalls = [];
  const { unmount } = renderHook(() => useStUsdsLaunch(params));
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

describe('useStUsdsLaunch — native supply calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.capturedWrite = null;
    h.nativeAllowance = 0n;
    h.curveHasAllowance = { USDS: false, stUSDS: false };
  });
  afterEach(() => cleanup());

  const params: StUsdsEngineParams = {
    flow: 'supply',
    amount: AMOUNT,
    selectedProvider: StUsdsProviderType.NATIVE,
    expectedOutput: SUPPLY_QUOTE_OUT
  };

  it('routes byte-identical calldata to the engine WITHOUT an existing allowance (approve + deposit)', () => {
    h.nativeAllowance = 0n;
    const orch = captureOrchestratorCalls(params);

    h.capturedCalls = [];
    h.nativeAllowance = 0n;
    const engine = renderHook(() =>
      useBatchStUsdsDeposit({ amount: AMOUNT, referral: REFERRAL_CODE, enabled: true })
    );
    const engineCalls = h.capturedCalls;
    engine.unmount();

    // Byte-for-byte: target, selector + encoded args, value.
    expect(orch.map(normalize)).toEqual(engineCalls.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'deposit']);
    // deposit(amount, receiver[, referral]) — referral appended only when > 0.
    expect(orch[1].args.slice(0, 2)).toEqual([AMOUNT, TEST_ADDRESS]);
  });

  it('elides the approve WITH an existing allowance (deposit only)', () => {
    h.nativeAllowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(params);
    expect(orch.map(c => c.functionName)).toEqual(['deposit']);
  });

  it('labels the supply steps "Approve USDS" / "Supply USDS", eliding the approve with allowance', () => {
    h.nativeAllowance = 0n;
    const a = renderHook(() => useStUsdsLaunch(params));
    expect(a.result.current.steps).toEqual(['Approve USDS', 'Supply USDS']);
    a.unmount();

    h.nativeAllowance = HAS_ALLOWANCE;
    const b = renderHook(() => useStUsdsLaunch(params));
    expect(b.result.current.steps).toEqual(['Supply USDS']);
    b.unmount();
  });
});

describe('useStUsdsLaunch — Curve supply calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.nativeAllowance = HAS_ALLOWANCE; // native path must not leak into the capture
    h.curveHasAllowance = { USDS: false, stUSDS: false };
  });
  afterEach(() => cleanup());

  const params: StUsdsEngineParams = {
    flow: 'supply',
    amount: AMOUNT,
    selectedProvider: StUsdsProviderType.CURVE,
    expectedOutput: SUPPLY_QUOTE_OUT
  };

  it('routes byte-identical calldata to the Curve engine (approve + exchange with min-output slippage)', () => {
    const orch = captureOrchestratorCalls(params);

    h.capturedCalls = [];
    const engine = renderHook(() =>
      useBatchCurveSwap({
        direction: StUsdsDirection.SUPPLY,
        inputAmount: AMOUNT,
        expectedOutput: SUPPLY_QUOTE_OUT,
        enabled: true
      })
    );
    const engineCalls = h.capturedCalls;
    engine.unmount();

    expect(orch.map(normalize)).toEqual(engineCalls.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'exchange']);

    // exchange(i=USDS, j=stUSDS, dx=amount, min_dy=quote−0.5%, receiver) — the
    // engine applies the config-default slippage; the orchestrator passes none.
    const minOutput = calculateMinOutputWithSlippage(SUPPLY_QUOTE_OUT, STUSDS_PROVIDER_CONFIG.maxSlippageBps);
    expect(orch[1].args).toEqual([0n, 1n, AMOUNT, minOutput, TEST_ADDRESS]);
  });

  it('elides the approve when the Curve USDS allowance is sufficient', () => {
    h.curveHasAllowance = { USDS: true, stUSDS: false };
    const orch = captureOrchestratorCalls(params);
    expect(orch.map(c => c.functionName)).toEqual(['exchange']);
  });
});

describe('useStUsdsLaunch — Curve withdraw calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.nativeAllowance = HAS_ALLOWANCE;
    h.curveHasAllowance = { USDS: false, stUSDS: false };
  });
  afterEach(() => cleanup());

  const params: StUsdsEngineParams = {
    flow: 'withdraw',
    amount: AMOUNT, // desired USDS out
    selectedProvider: StUsdsProviderType.CURVE,
    expectedOutput: AMOUNT,
    stUsdsAmount: WITHDRAW_STUSDS_IN // quoted stUSDS in
  };

  it('routes byte-identical calldata to the Curve engine (stUSDS input from the quote)', () => {
    const orch = captureOrchestratorCalls(params);

    h.capturedCalls = [];
    const engine = renderHook(() =>
      useBatchCurveSwap({
        direction: StUsdsDirection.WITHDRAW,
        inputAmount: WITHDRAW_STUSDS_IN,
        expectedOutput: AMOUNT,
        enabled: true
      })
    );
    const engineCalls = h.capturedCalls;
    engine.unmount();

    expect(orch.map(normalize)).toEqual(engineCalls.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'exchange']);

    // exchange(i=stUSDS, j=USDS, dx=quoted stUSDS, min_dy=desired USDS−0.5%, receiver)
    const minOutput = calculateMinOutputWithSlippage(AMOUNT, STUSDS_PROVIDER_CONFIG.maxSlippageBps);
    expect(orch[1].args).toEqual([1n, 0n, WITHDRAW_STUSDS_IN, minOutput, TEST_ADDRESS]);
  });

  it('labels the Curve withdraw steps "Approve stUSDS" / "Withdraw USDS"', () => {
    const { result, unmount } = renderHook(() => useStUsdsLaunch(params));
    expect(result.current.steps).toEqual(['Approve stUSDS', 'Withdraw USDS']);
    unmount();
  });
});

describe('useStUsdsLaunch — native withdraw params parity (useWriteContractFlow seam)', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.capturedWrite = null;
    h.nativeAllowance = HAS_ALLOWANCE;
    h.curveHasAllowance = { USDS: false, stUSDS: false };
  });
  afterEach(() => cleanup());

  it('routes a partial withdraw to withdraw(assets, receiver, owner)', () => {
    const { unmount } = renderHook(() =>
      useStUsdsLaunch({
        flow: 'withdraw',
        amount: AMOUNT,
        max: false,
        selectedProvider: StUsdsProviderType.NATIVE,
        expectedOutput: AMOUNT
      })
    );
    expect(h.capturedWrite?.functionName).toBe('withdraw');
    expect(h.capturedWrite?.args).toEqual([AMOUNT, TEST_ADDRESS, TEST_ADDRESS]);
    unmount();
  });

  it('routes a Max withdraw to redeem(shares, receiver, owner) — the whole share balance, no dust', () => {
    const { result, unmount } = renderHook(() =>
      useStUsdsLaunch({
        flow: 'withdraw',
        amount: AMOUNT,
        max: true,
        selectedProvider: StUsdsProviderType.NATIVE,
        expectedOutput: AMOUNT
      })
    );
    expect(h.capturedWrite?.functionName).toBe('redeem');
    // Shares from the mocked position (42 stUSDS), not the entered USDS amount.
    expect(h.capturedWrite?.args).toEqual([parseUnits('42', 18), TEST_ADDRESS, TEST_ADDRESS]);
    expect(result.current.steps).toEqual(['Withdraw USDS']);
    unmount();
  });
});
