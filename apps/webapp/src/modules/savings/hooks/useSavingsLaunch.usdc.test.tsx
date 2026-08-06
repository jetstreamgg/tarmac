/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const USDC_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();
const PSM_WRAPPER_MAINNET = '0xA188EEC8F81263234dA3622A406892F3D630f98c'.toLowerCase();
const USDS_MAINNET = '0xdC035D45d973E3EC169d2276DDab16f1e407384F'.toLowerCase();
const SUSDS_MAINNET = '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD'.toLowerCase();

const h = vi.hoisted(() => ({
  capturedCalls: [] as RawCall[],
  activeSupplyExecute: vi.fn(),
  idleSupplyExecute: vi.fn(),
  withdrawExecute: vi.fn(),
  launchMock: vi.fn(),
  // USDS -> sUSDS allowance (useSavingsAllowance) and USDC -> PSM-wrapper allowance
  // (useTokenAllowance, keyed on the spender below). Both derivations live inside
  // the engine; the test only controls the on-chain values they read.
  usdsAllowance: 0n as bigint | undefined,
  usdcAllowance: 0n as bigint | undefined
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

// Withdraw engine seam (mounted unconditionally by the orchestrator, disabled here).
vi.mock('@/hooks/shared/useWriteContractFlow', () => ({
  useWriteContractFlow: () => ({
    error: null,
    prepareError: null,
    isLoading: false,
    prepared: false,
    execute: h.withdrawExecute,
    data: undefined,
    retryPrepare: () => undefined
  })
}));

// Capture the Call[] the ACTIVE batch engine hands to the transaction flow. The
// orchestrator mounts every supply engine (hooks rules); only the routed one is
// enabled, so gate the capture on `enabled`.
vi.mock('@/hooks/shared/useTransactionFlow', () => ({
  useTransactionFlow: (params: { calls: RawCall[]; enabled?: boolean }) => {
    if (params.enabled) h.capturedCalls = params.calls;
    return {
      error: null,
      isLoading: false,
      prepared: true,
      execute: params.enabled ? h.activeSupplyExecute : h.idleSupplyExecute,
      currentCallIndex: 0,
      reset: () => undefined
    };
  }
}));

// USDS -> sUSDS allowance.
vi.mock('@/hooks/savings/useSavingsAllowance', () => ({
  useSavingsAllowance: () => ({
    data: h.usdsAllowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

// The orchestrator reads several allowances through this hook (DAI→daiUsds, the L2
// PSM legs, and USDC→the PSM wrapper). Only the wrapper spender carries the USDC
// value; everything else answers 0 so no other path's approve is elided by accident.
vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: ({ spender }: { spender?: string }) => ({
    data: spender?.toLowerCase() === PSM_WRAPPER_MAINNET ? h.usdcAllowance : 0n,
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

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [false, () => undefined]
}));
vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({ data: false })
}));

import { TOKENS, useBatchPsmSwapAndSavingsSupply } from '@/hooks';
import { useSavingsLaunch } from './useSavingsLaunch';

const AMOUNT = parseUnits('10', 6); // 10 USDC — 6 decimals, everywhere
const AMOUNT_WAD = parseUnits('10', 18); // what the wrapper mints for it at a zero fee
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
    useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usdc, amount, referralCode: ref })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

function captureEngineCalls(amount: bigint, ref?: number): RawCall[] {
  const { unmount } = renderHook(() => useBatchPsmSwapAndSavingsSupply({ amount, ref, enabled: true }));
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

describe('useSavingsLaunch — mainnet USDC swap-and-supply calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.activeSupplyExecute.mockClear();
    h.idleSupplyExecute.mockClear();
    h.withdrawExecute.mockClear();
    h.launchMock.mockClear();
    h.usdsAllowance = 0n;
    h.usdcAllowance = 0n;
  });
  afterEach(() => cleanup());

  it('matches the engine with NO allowances (approve-USDC, sellGem, approve-USDS, deposit)', () => {
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'sellGem', 'approve', 'deposit']);

    // approve USDC -> the PSM wrapper, at the 6-dec input amount
    expect(normalize(orch[0]).to).toBe(USDC_MAINNET);
    expect((orch[0].args[0] as string).toLowerCase()).toBe(PSM_WRAPPER_MAINNET);
    expect(orch[0].args[1]).toBe(AMOUNT);
    // sellGem: USDC -> USDS, straight to the connected user
    expect(normalize(orch[1]).to).toBe(PSM_WRAPPER_MAINNET);
    expect(orch[1].args).toEqual([TEST_ADDRESS, AMOUNT]);
    // approve USDS -> sUSDS, at the WIDENED wad (not the 6-dec input)
    expect(normalize(orch[2]).to).toBe(USDS_MAINNET);
    expect((orch[2].args[0] as string).toLowerCase()).toBe(SUSDS_MAINNET);
    expect(orch[2].args[1]).toBe(AMOUNT_WAD);
    // deposit the widened wad into sUSDS
    expect(normalize(orch[3]).to).toBe(SUSDS_MAINNET);
    expect(orch[3].args).toEqual([AMOUNT_WAD, TEST_ADDRESS, REF]);
  });

  it('matches the engine WITH the USDC allowance, NO USDS allowance (sellGem, approve-USDS, deposit)', () => {
    h.usdcAllowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['sellGem', 'approve', 'deposit']);
  });

  it('matches the engine WITH both allowances (sellGem, deposit)', () => {
    h.usdcAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['sellGem', 'deposit']);
  });

  it('keeps the USDS approve when the allowance covers the 6-dec input but not the wad', () => {
    h.usdcAllowance = HAS_ALLOWANCE;
    // 10e6 ≥ the raw input but nowhere near the 10e18 the deposit spends.
    h.usdsAllowance = AMOUNT;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    expect(orch.map(c => c.functionName)).toEqual(['sellGem', 'approve', 'deposit']);
  });

  it('encodes the referral code as a number (not bigint) in the deposit args', () => {
    h.usdcAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const deposit = orch[orch.length - 1];
    expect(deposit.functionName).toBe('deposit');
    expect(typeof deposit.args[2]).toBe('number');
    expect(deposit.args[2]).toBe(REF);
  });
});

describe('useSavingsLaunch — mainnet USDC swap-and-supply launch() config', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.activeSupplyExecute.mockClear();
    h.idleSupplyExecute.mockClear();
    h.withdrawExecute.mockClear();
    h.launchMock.mockClear();
    h.usdsAllowance = 0n;
    h.usdcAllowance = 0n;
  });
  afterEach(() => cleanup());

  it('renders the full 4-step progression when no allowance is present', () => {
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usdc, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    expect(config.steps).toEqual([
      { label: 'Approve', tokenSymbol: 'USDC', failureDetail: "The USDC hasn't been approved." },
      'Convert USDC to USDS',
      { label: 'Approve', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been approved." },
      { label: 'Supply', tokenSymbol: 'USDS' }
    ]);
  });

  it('elides each approve step when its allowance is already present (steps match call count)', () => {
    h.usdcAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usdc, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    expect(config.steps).toEqual(['Convert USDC to USDS', { label: 'Supply', tokenSymbol: 'USDS' }]);
  });

  it('reports the amount in USDC units in the analytics payload', () => {
    h.usdcAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usdc, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    expect(config.analytics.data.originToken).toBe('USDC');
    // 10 USDC, read at 6 decimals — not 1e-11.
    expect(config.analytics.data.amount).toBe(10);
  });

  it('routes onConfirm to the enabled USDC engine (not the idle engines, not withdraw)', () => {
    h.usdcAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usdc, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    config.onConfirm();
    expect(h.activeSupplyExecute).toHaveBeenCalledTimes(1);
    expect(h.idleSupplyExecute).not.toHaveBeenCalled();
    expect(h.withdrawExecute).not.toHaveBeenCalled();
  });
});
