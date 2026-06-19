/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const DAI_MAINNET = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase();
const DAI_USDS_MAINNET = '0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A'.toLowerCase();
const USDS_MAINNET = '0xdC035D45d973E3EC169d2276DDab16f1e407384F'.toLowerCase();
const SUSDS_MAINNET = '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD'.toLowerCase();

// Shared mutable state for the module mocks below. `vi.hoisted` runs before the
// `vi.mock` factories so they can close over it.
const h = vi.hoisted(() => ({
  capturedCalls: [] as RawCall[],
  // useTransactionFlow returns the active execute only when enabled — so the
  // disabled plain-USDS-supply engine the orchestrator also mounts can't be
  // mistaken for the routed engine.
  activeSupplyExecute: vi.fn(),
  idleSupplyExecute: vi.fn(),
  withdrawExecute: vi.fn(),
  launchMock: vi.fn(),
  // USDS -> sUSDS allowance (useSavingsAllowance) and DAI -> daiUsds allowance
  // (useTokenAllowance). Both derivations live inside the engine; the test only
  // controls the on-chain values they read.
  usdsAllowance: 0n as bigint | undefined,
  daiAllowance: 0n as bigint | undefined
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
    // useBatchUpgradeAndSavingsSupply (and the orchestrator's DAI step-label read)
    // use useAccount, not useConnection.
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
// orchestrator mounts BOTH useBatchSavingsSupply and useBatchUpgradeAndSavingsSupply
// (hooks rules); only the routed one is enabled, so gate the capture on `enabled`.
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

// USDS -> sUSDS allowance (landmine #1 lives inside the engine that reads this).
vi.mock('@/hooks/savings/useSavingsAllowance', () => ({
  useSavingsAllowance: () => ({
    data: h.usdsAllowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

// DAI -> daiUsds allowance. The upgrade engine and the orchestrator (step labels)
// read this hook; both must see the same value.
vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: () => ({
    data: h.daiAllowance,
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

import { TOKENS, useBatchUpgradeAndSavingsSupply } from '@/hooks';
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
    useSavingsLaunch({ flow: 'supply', originToken: TOKENS.dai, amount, referralCode: ref })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

function captureEngineCalls(amount: bigint, ref?: number): RawCall[] {
  const { unmount } = renderHook(() => useBatchUpgradeAndSavingsSupply({ amount, ref, enabled: true }));
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

describe('useSavingsLaunch — mainnet DAI upgrade-and-supply calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.activeSupplyExecute.mockClear();
    h.idleSupplyExecute.mockClear();
    h.withdrawExecute.mockClear();
    h.launchMock.mockClear();
    h.usdsAllowance = 0n;
    h.daiAllowance = 0n;
  });
  afterEach(() => cleanup());

  it('matches the engine with NO DAI and NO USDS allowance (approve-DAI, upgrade, approve-USDS, supply)', () => {
    h.daiAllowance = 0n;
    h.usdsAllowance = 0n;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    h.daiAllowance = 0n;
    h.usdsAllowance = 0n;
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'daiToUsds', 'approve', 'deposit']);

    // approve DAI -> daiUsds
    expect(normalize(orch[0]).to).toBe(DAI_MAINNET);
    expect((orch[0].args[0] as string).toLowerCase()).toBe(DAI_USDS_MAINNET);
    expect(orch[0].args[1]).toBe(AMOUNT);
    // upgrade DAI -> USDS for the connected user
    expect(normalize(orch[1]).to).toBe(DAI_USDS_MAINNET);
    expect(orch[1].args).toEqual([TEST_ADDRESS, AMOUNT]);
    // approve USDS -> sUSDS
    expect(normalize(orch[2]).to).toBe(USDS_MAINNET);
    expect((orch[2].args[0] as string).toLowerCase()).toBe(SUSDS_MAINNET);
    // deposit into sUSDS
    expect(normalize(orch[3]).to).toBe(SUSDS_MAINNET);
    expect(orch[3].args).toEqual([AMOUNT, TEST_ADDRESS, REF]);
  });

  it('matches the engine WITH DAI allowance, NO USDS allowance (upgrade, approve-USDS, supply)', () => {
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = 0n;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = 0n;
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['daiToUsds', 'approve', 'deposit']);
  });

  it('matches the engine WITH USDS allowance, NO DAI allowance (approve-DAI, upgrade, supply)', () => {
    h.daiAllowance = 0n;
    h.usdsAllowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    h.daiAllowance = 0n;
    h.usdsAllowance = HAS_ALLOWANCE;
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'daiToUsds', 'deposit']);
  });

  it('matches the engine WITH both allowances present (upgrade, supply)', () => {
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const engine = captureEngineCalls(AMOUNT, REF);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch.map(c => c.functionName)).toEqual(['daiToUsds', 'deposit']);
  });

  it('encodes the referral code as a number (not bigint) in the deposit args', () => {
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const deposit = orch[orch.length - 1];
    expect(deposit.functionName).toBe('deposit');
    expect(typeof deposit.args[2]).toBe('number');
    expect(deposit.args[2]).toBe(REF);
  });
});

describe('useSavingsLaunch — landmine #1: dual allowance derivation stays in the engine', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.usdsAllowance = 0n;
    h.daiAllowance = 0n;
  });
  afterEach(() => cleanup());

  it('emits neither approve when both allowances are sufficient', () => {
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    expect(orch.some(c => c.functionName === 'approve')).toBe(false);
    expect(orch.map(c => c.functionName)).toEqual(['daiToUsds', 'deposit']);
  });

  it('emits both approves only because the engine derived them, in the engine ordering', () => {
    h.daiAllowance = 0n;
    h.usdsAllowance = 0n;
    const orch = captureOrchestratorCalls(AMOUNT, REF);
    const engine = captureEngineCalls(AMOUNT, REF);
    // The orchestrator never constructs, reorders, or re-derives approve calls.
    expect(orch.map(c => c.functionName)).toEqual(engine.map(c => c.functionName));
  });
});

describe('useSavingsLaunch — DAI upgrade-and-supply launch() config', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.activeSupplyExecute.mockClear();
    h.idleSupplyExecute.mockClear();
    h.withdrawExecute.mockClear();
    h.launchMock.mockClear();
    h.usdsAllowance = 0n;
    h.daiAllowance = 0n;
  });
  afterEach(() => cleanup());

  it('opens the modal with savings supply analytics under originToken DAI', () => {
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.dai, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = h.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('savings');
    expect(config.analytics.flow).toBe('supply');
    expect(config.analytics.action).toBe('supply');
    expect(config.analytics.data.originToken).toBe('DAI');
  });

  it('renders the full 4-step progression when no allowance is present', () => {
    h.daiAllowance = 0n;
    h.usdsAllowance = 0n;
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.dai, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    expect(config.steps).toEqual(['Approve DAI', 'Upgrade DAI to USDS', 'Approve USDS', 'Supply USDS']);
  });

  it('elides each approve step when its allowance is already present (steps match call count)', () => {
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.dai, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    expect(config.steps).toEqual(['Upgrade DAI to USDS', 'Supply USDS']);
  });

  it('routes onConfirm to the enabled upgrade engine (not the disabled supply engine, not withdraw)', () => {
    h.daiAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = HAS_ALLOWANCE;
    const { result } = renderHook(() =>
      useSavingsLaunch({ flow: 'supply', originToken: TOKENS.dai, amount: AMOUNT, referralCode: REF })
    );
    act(() => result.current.launch());

    const config = h.launchMock.mock.calls[0][0];
    config.onConfirm();
    expect(h.activeSupplyExecute).toHaveBeenCalledTimes(1);
    expect(h.idleSupplyExecute).not.toHaveBeenCalled();
    expect(h.withdrawExecute).not.toHaveBeenCalled();
  });
});
