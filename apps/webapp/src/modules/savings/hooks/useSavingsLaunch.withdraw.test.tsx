/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const SUSDS_MAINNET = '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD'.toLowerCase();

// Shared mutable state for the module mocks below. `vi.hoisted` runs before the
// `vi.mock` factories so they can close over it.
const h = vi.hoisted(() => ({
  // Captured at the engine's calldata seam (useWriteContractFlow simulates a
  // single write — the withdraw path has no approve leg).
  capturedWrite: null as WriteParams | null,
  mockWithdrawExecute: vi.fn(),
  mockSupplyExecute: vi.fn(),
  launchMock: vi.fn(),
  // Resolved by the engine for a `max` withdraw (maxWithdraw(owner)).
  maxWithdraw: undefined as bigint | undefined
}));

type WriteParams = {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
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

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: () => undefined })
  };
});

// Capture the exact write the withdraw engine hands to useWriteContractFlow —
// this is the only channel through which withdraw calldata leaves the engine,
// so it is precisely "the call that gets signed". The engine is left unmodified.
vi.mock('@/hooks/shared/useWriteContractFlow', () => ({
  useWriteContractFlow: (params: WriteParams) => {
    h.capturedWrite = {
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args
    };
    return {
      error: null,
      prepareError: null,
      isLoading: false,
      prepared: true,
      execute: h.mockWithdrawExecute,
      data: undefined,
      retryPrepare: () => undefined
    };
  }
}));

// The orchestrator calls useBatchSavingsSupply unconditionally (hooks rules),
// gated to enabled:false on the withdraw flow. Stub its calldata seam + allowance.
vi.mock('@/hooks/shared/useTransactionFlow', () => ({
  useTransactionFlow: () => ({
    error: null,
    isLoading: false,
    prepared: false,
    execute: h.mockSupplyExecute,
    currentCallIndex: 0,
    reset: () => undefined
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

// DAI -> daiUsds allowance, read by the always-mounted (disabled) upgrade engine
// and the orchestrator. Irrelevant to the withdraw path under test.
vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: () => ({
    data: 0n,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

// The engine derives `enabled` from the user's savings position; give it a large
// balance so the derivation never gates out (it does not affect captured args).
vi.mock('@/hooks/savings/useSavingsData', () => ({
  useSavingsData: () => ({
    data: {
      userSavingsBalance: parseUnits('1000000', 18),
      userNstBalance: 0n,
      savingsRate: 0n,
      savingsTvl: 0n
    },
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

// Resolve maxWithdraw(owner) for the `max` path; preserve the real address/ABI
// exports both engines import from this module.
vi.mock('@/hooks/savings/useReadSavingsUsds', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/savings/useReadSavingsUsds')>();
  return {
    ...actual,
    useReadSavingsUsdsMaxWithdraw: () => ({ data: h.maxWithdraw, queryKey: ['maxWithdraw'] })
  };
});

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

import { TOKENS, useSavingsWithdraw } from '@/hooks';
import { useSavingsLaunch } from './useSavingsLaunch';

const AMOUNT = parseUnits('5', 18);
const MAX_WITHDRAW = parseUnits('123.456789012345678', 18);

function normalize(call: WriteParams) {
  return {
    to: call.address.toLowerCase(),
    data: encodeFunctionData({
      abi: call.abi as Parameters<typeof encodeFunctionData>[0]['abi'],
      functionName: call.functionName,
      args: call.args
    })
  };
}

function captureOrchestratorWithdraw(amount: bigint, max: boolean): WriteParams {
  h.capturedWrite = null;
  const { unmount } = renderHook(() =>
    useSavingsLaunch({ flow: 'withdraw', originToken: TOKENS.usds, amount, max })
  );
  const call = h.capturedWrite;
  unmount();
  if (!call) throw new Error('orchestrator did not route to the withdraw engine');
  return call;
}

function captureEngineWithdraw(amount: bigint, max: boolean): WriteParams {
  h.capturedWrite = null;
  const { unmount } = renderHook(() => useSavingsWithdraw({ amount, max, enabled: true }));
  const call = h.capturedWrite;
  unmount();
  if (!call) throw new Error('engine did not produce a withdraw call');
  return call;
}

describe('useSavingsLaunch — mainnet USDS withdraw calldata parity', () => {
  beforeEach(() => {
    h.capturedWrite = null;
    h.mockWithdrawExecute.mockClear();
    h.mockSupplyExecute.mockClear();
    h.launchMock.mockClear();
    h.maxWithdraw = undefined;
  });
  afterEach(() => cleanup());

  it('routes byte-identical calldata to the engine for an explicit-amount withdraw', () => {
    const orch = captureOrchestratorWithdraw(AMOUNT, false);
    const engine = captureEngineWithdraw(AMOUNT, false);

    // Byte-for-byte: target, selector + encoded args.
    expect(normalize(orch)).toEqual(normalize(engine));

    expect(normalize(orch).to).toBe(SUSDS_MAINNET);
    expect(orch.functionName).toBe('withdraw');
    // withdraw(amount, receiver, owner) — all three are the connected user today.
    expect(orch.args).toEqual([AMOUNT, TEST_ADDRESS, TEST_ADDRESS]);
  });

  it('routes byte-identical calldata for a max withdraw (amount resolved via maxWithdraw)', () => {
    h.maxWithdraw = MAX_WITHDRAW;
    // The input amount is deliberately a non-matching sentinel: a max withdraw
    // must resolve to maxWithdraw(owner), NOT the panel's input amount.
    const orch = captureOrchestratorWithdraw(AMOUNT, true);
    h.maxWithdraw = MAX_WITHDRAW;
    const engine = captureEngineWithdraw(AMOUNT, true);

    expect(normalize(orch)).toEqual(normalize(engine));
    // Resolved amount is the engine's maxWithdraw — never the AMOUNT sentinel.
    expect(orch.args).toEqual([MAX_WITHDRAW, TEST_ADDRESS, TEST_ADDRESS]);
    expect(orch.args[0]).toBe(MAX_WITHDRAW);
    expect(orch.args[0]).not.toBe(AMOUNT);
  });
});

describe('useSavingsLaunch — withdraw launch() config', () => {
  beforeEach(() => {
    h.capturedWrite = null;
    h.mockWithdrawExecute.mockClear();
    h.mockSupplyExecute.mockClear();
    h.launchMock.mockClear();
    h.maxWithdraw = undefined;
  });
  afterEach(() => cleanup());

  it('opens the modal with savings withdraw analytics (widgetName/flow/action)', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'withdraw', originToken: TOKENS.usds, amount: AMOUNT })
    );
    act(() => result.current.launch());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = h.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('savings');
    expect(config.analytics.flow).toBe('withdraw');
    expect(config.analytics.action).toBe('withdraw');
    expect(config.title).toBe('Withdraw from Sky Savings');
    expect(config.transactionTitle).toBe('Confirm in the wallet');
    expect(config.confirmLabel).toBe('Withdraw');
  });

  it('routes onConfirm to the withdraw engine execute (not the supply engine), single step', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'withdraw', originToken: TOKENS.usds, amount: AMOUNT })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    // Withdraw needs no approval — exactly one step.
    expect(config.steps).toHaveLength(1);
    config.onConfirm();
    expect(h.mockWithdrawExecute).toHaveBeenCalledTimes(1);
    expect(h.mockSupplyExecute).not.toHaveBeenCalled();
  });
});
