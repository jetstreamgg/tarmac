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
  capturedWrite: undefined as RawWriteParams | undefined,
  mockBatchExecute: vi.fn(),
  mockWriteExecute: vi.fn(),
  allowance: 0n as bigint | undefined
}));

type RawCall = {
  to: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
};

type RawWriteParams = {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  enabled?: boolean;
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

// Capture the exact Call[] the engine hands to the transaction flow — this is
// the only channel through which calldata leaves useBatchRewardsSupply, so it is
// precisely "the calls that get signed". The engine itself is left unmodified.
// The orchestrator also mounts the (disabled) withdraw engine; guard the capture
// on `enabled` so only the routed engine's calls are recorded.
vi.mock('@/hooks/shared/useTransactionFlow', () => ({
  useTransactionFlow: (params: { calls: RawCall[]; enabled?: boolean }) => {
    if (params.enabled) h.capturedCalls = params.calls;
    return {
      error: null,
      isLoading: false,
      prepared: true,
      execute: h.mockBatchExecute,
      currentCallIndex: 0,
      reset: () => undefined
    };
  }
}));

// The withdraw engine (useRewardsWithdraw) submits through useWriteContractFlow —
// its parameters (address/abi/functionName/args) are exactly what gets simulated
// and signed, so capture them at this seam. Guarded on `enabled` for the same
// reason as above (the supply flow mounts the withdraw engine disabled).
vi.mock('@/hooks/shared/useWriteContractFlow', () => ({
  useWriteContractFlow: (params: RawWriteParams) => {
    if (params.enabled) h.capturedWrite = params;
    return {
      error: null,
      prepareError: null,
      isLoading: false,
      prepared: true,
      execute: h.mockWriteExecute,
      data: undefined,
      retryPrepare: () => undefined
    };
  }
}));

// Control the allowance both the engine and the orchestrator's read-only step
// labelling see (landmine #1 lives inside the engine's read of this hook).
vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: () => ({
    data: h.allowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
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

// The orchestrator derives shouldUseBatch from the batch toggle + wallet
// capability; stub both (batching itself is engine behaviour, not under test).
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [false, () => undefined]
}));
vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({ data: false })
}));

import { TOKENS, useBatchRewardsSupply, useRewardsWithdraw } from '@/hooks';
import { usdsSpkRewardAddress } from '@/hooks/generated';
import { REFERRAL_CODE } from '@/lib/constants';
import { useRewardsLaunch } from './useRewardsLaunch';

const SPK_CONTRACT = usdsSpkRewardAddress[1];
const USDS_MAINNET = TOKENS.usds.address[1].toLowerCase();
const AMOUNT = parseUnits('10', 18);
const HAS_ALLOWANCE = parseUnits('1000000', 18);

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

function normalizeWrite(params: RawWriteParams) {
  return {
    to: params.address.toLowerCase(),
    data: encodeFunctionData({
      abi: params.abi as Parameters<typeof encodeFunctionData>[0]['abi'],
      functionName: params.functionName,
      args: params.args
    })
  };
}

function captureOrchestratorSupplyCalls(amount: bigint): RawCall[] {
  const { unmount } = renderHook(() =>
    useRewardsLaunch({ flow: 'supply', contractAddress: SPK_CONTRACT, supplyToken: TOKENS.usds, amount })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

function captureEngineSupplyCalls(amount: bigint): RawCall[] {
  const { unmount } = renderHook(() =>
    useBatchRewardsSupply({
      contractAddress: SPK_CONTRACT,
      supplyTokenAddress: TOKENS.usds.address[1],
      amount,
      ref: REFERRAL_CODE,
      enabled: true
    })
  );
  const calls = h.capturedCalls;
  unmount();
  return calls;
}

describe('useRewardsLaunch — mainnet USDS supply calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.capturedWrite = undefined;
    h.mockBatchExecute.mockClear();
    h.mockWriteExecute.mockClear();
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('routes byte-identical calldata to the engine WITHOUT an existing allowance (approve + stake)', () => {
    h.allowance = 0n;
    const orch = captureOrchestratorSupplyCalls(AMOUNT);
    h.allowance = 0n;
    const engine = captureEngineSupplyCalls(AMOUNT);

    // Byte-for-byte: target, selector + encoded args, value.
    expect(orch.map(normalize)).toEqual(engine.map(normalize));

    expect(orch).toHaveLength(2);
    expect(normalize(orch[0]).to).toBe(USDS_MAINNET);
    expect(orch[0].functionName).toBe('approve');
    expect((orch[0].args[0] as string).toLowerCase()).toBe(SPK_CONTRACT.toLowerCase());
    expect(orch[0].args[1]).toBe(AMOUNT);

    expect(normalize(orch[1]).to).toBe(SPK_CONTRACT.toLowerCase());
    expect(orch[1].functionName).toBe('stake');
    expect(orch[1].args).toEqual([AMOUNT, REFERRAL_CODE]);
  });

  it('routes byte-identical calldata to the engine WITH an existing allowance (stake only)', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorSupplyCalls(AMOUNT);
    h.allowance = HAS_ALLOWANCE;
    const engine = captureEngineSupplyCalls(AMOUNT);

    expect(orch.map(normalize)).toEqual(engine.map(normalize));
    expect(orch).toHaveLength(1);
    expect(orch[0].functionName).toBe('stake');
    expect(normalize(orch[0]).to).toBe(SPK_CONTRACT.toLowerCase());
  });

  it('passes the referral code through to stake exactly as the legacy widget did', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorSupplyCalls(AMOUNT);
    const stake = orch[orch.length - 1];
    expect(stake.functionName).toBe('stake');
    expect(typeof stake.args[1]).toBe('number');
    expect(stake.args[1]).toBe(REFERRAL_CODE);
  });
});

describe('useRewardsLaunch — landmine #1: approve/allowance derivation stays in the engine', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('does NOT inject an approve call when the engine reports a sufficient allowance', () => {
    h.allowance = HAS_ALLOWANCE;
    const orch = captureOrchestratorSupplyCalls(AMOUNT);
    expect(orch).toHaveLength(1);
    expect(orch.some(c => c.functionName === 'approve')).toBe(false);
  });

  it('includes the approve call only because the engine derived it, in the engine ordering', () => {
    h.allowance = 0n;
    const orch = captureOrchestratorSupplyCalls(AMOUNT);
    const engine = captureEngineSupplyCalls(AMOUNT);
    // The orchestrator never constructs, reorders, or re-derives approve calls —
    // presence and ordering match the engine exactly.
    expect(orch.map(c => c.functionName)).toEqual(['approve', 'stake']);
    expect(orch.map(c => c.functionName)).toEqual(engine.map(c => c.functionName));
  });
});

describe('useRewardsLaunch — withdraw calldata parity', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.capturedWrite = undefined;
    h.mockWriteExecute.mockClear();
    h.allowance = HAS_ALLOWANCE;
  });
  afterEach(() => cleanup());

  it('routes byte-identical withdraw(amount) parameters to the engine seam', () => {
    const { unmount } = renderHook(() =>
      useRewardsLaunch({
        flow: 'withdraw',
        contractAddress: SPK_CONTRACT,
        supplyToken: TOKENS.usds,
        amount: AMOUNT
      })
    );
    const orch = h.capturedWrite;
    unmount();
    h.capturedWrite = undefined;

    const engine = renderHook(() =>
      useRewardsWithdraw({ contractAddress: SPK_CONTRACT, amount: AMOUNT, enabled: true })
    );
    const direct = h.capturedWrite;
    engine.unmount();

    expect(orch).toBeDefined();
    expect(direct).toBeDefined();
    expect(normalizeWrite(orch!)).toEqual(normalizeWrite(direct!));
    expect(orch!.functionName).toBe('withdraw');
    expect(orch!.args).toEqual([AMOUNT]);
    expect(orch!.address.toLowerCase()).toBe(SPK_CONTRACT.toLowerCase());
  });

  it('routes execute to the withdraw engine on the withdraw flow', () => {
    const { result, unmount } = renderHook(() =>
      useRewardsLaunch({
        flow: 'withdraw',
        contractAddress: SPK_CONTRACT,
        supplyToken: TOKENS.usds,
        amount: AMOUNT
      })
    );
    result.current.execute();
    expect(h.mockWriteExecute).toHaveBeenCalledTimes(1);
    expect(h.mockBatchExecute).not.toHaveBeenCalled();
    unmount();
  });
});

describe('useRewardsLaunch — step labels', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.allowance = 0n;
  });
  afterEach(() => cleanup());

  it('labels the supply steps "Approve USDS" / "Supply USDS", eliding the approve with allowance', () => {
    h.allowance = 0n;
    const a = renderHook(() =>
      useRewardsLaunch({ flow: 'supply', contractAddress: SPK_CONTRACT, supplyToken: TOKENS.usds, amount: AMOUNT })
    );
    expect(a.result.current.steps).toEqual(['Approve USDS', 'Supply USDS']);
    a.unmount();

    h.allowance = HAS_ALLOWANCE;
    const b = renderHook(() =>
      useRewardsLaunch({ flow: 'supply', contractAddress: SPK_CONTRACT, supplyToken: TOKENS.usds, amount: AMOUNT })
    );
    expect(b.result.current.steps).toEqual(['Supply USDS']);
    b.unmount();
  });

  it('labels the withdraw flow with a single "Withdraw USDS" step', () => {
    const { result, unmount } = renderHook(() =>
      useRewardsLaunch({
        flow: 'withdraw',
        contractAddress: SPK_CONTRACT,
        supplyToken: TOKENS.usds,
        amount: AMOUNT
      })
    );
    expect(result.current.steps).toEqual(['Withdraw USDS']);
    unmount();
  });
});
