/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getAddress } from 'viem';

// Mutable mock state shared with the hoisted `vi.mock` factory below. Each test
// resets it via `beforeEach`. The hook fetches the urn-selected reward/delegate
// itself, so we control those returns here and record the args the hook passes
// (to prove the `urnAddress || ZERO_ADDRESS` fallback parity with the legacy
// context).
const mockState = vi.hoisted(() => ({
  urnSelectedReward: undefined as `0x${string}` | undefined,
  urnSelectedDelegate: undefined as `0x${string}` | undefined,
  rewardCalls: [] as Array<{ urn: `0x${string}` }>,
  delegateCalls: [] as Array<{ urn: `0x${string}` }>
}));

// Mock ONLY the two live on-chain reads the hook wires itself, keeping every
// `getStake*Calldata` encoder REAL (pure viem `encodeFunctionData`, no network)
// so the hook's output is byte-real.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeUrnSelectedRewardContract: (args: { urn: `0x${string}` }) => {
      mockState.rewardCalls.push(args);
      return { data: mockState.urnSelectedReward, refetch: () => {} };
    },
    useStakeUrnSelectedVoteDelegate: (args: { urn: `0x${string}` }) => {
      mockState.delegateCalls.push(args);
      return { data: mockState.urnSelectedDelegate, refetch: () => {} };
    }
  };
});

import { ZERO_ADDRESS } from '@/hooks';
import {
  generateStakeCalldata,
  useStakeCalldata,
  type GenerateStakeCalldataParams,
  type UseStakeCalldataParams
} from './useStakeCalldata';

const OWNER = '0x000000000000000000000000000000000000beef' as `0x${string}`;
const URN = '0x00000000000000000000000000000000000000aa' as `0x${string}`;
// All-lowercase so the case-insensitive gating compare is exercised; the
// checksummed (mixed-case) form is what gets encoded when a select IS emitted.
const FARM = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const FARM2 = getAddress('0x3333333333333333333333333333333333333333');
const DELEGATE = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const DELEGATE2 = getAddress('0x4444444444444444444444444444444444444444');

/** Hook input = pure-function input MINUS the two internally-fetched values. */
function hookParams(overrides: Partial<UseStakeCalldataParams> = {}): UseStakeCalldataParams {
  return {
    flow: 'manage',
    ownerAddress: OWNER,
    urnIndex: 0n,
    urnAddress: URN,
    skyToLock: 0n,
    skyToFree: 0n,
    usdsToWipe: 0n,
    wipeAll: false,
    usdsToBorrow: 0n,
    selectedRewardContract: undefined,
    selectedDelegate: undefined,
    rewardContractsToClaim: undefined,
    restakeSkyRewards: false,
    restakeSkyAmount: 0n,
    referralCode: 0,
    ...overrides
  };
}

/** The same inputs the hook feeds the pure function once the fetched values are folded in. */
function pureParams(params: UseStakeCalldataParams): GenerateStakeCalldataParams {
  return {
    ...params,
    urnSelectedRewardContract: mockState.urnSelectedReward,
    urnSelectedVoteDelegate: mockState.urnSelectedDelegate
  };
}

describe('useStakeCalldata', () => {
  beforeEach(() => {
    mockState.urnSelectedReward = undefined;
    mockState.urnSelectedDelegate = undefined;
    mockState.rewardCalls = [];
    mockState.delegateCalls = [];
  });

  it('fetches the urn-selected reward/delegate with the active urn address', () => {
    const params = hookParams({ urnAddress: URN });
    renderHook(() => useStakeCalldata(params));

    expect(mockState.rewardCalls[0]).toEqual({ urn: URN });
    expect(mockState.delegateCalls[0]).toEqual({ urn: URN });
  });

  it('falls back to ZERO_ADDRESS for the fetch when there is no active urn (open flow)', () => {
    const params = hookParams({ flow: 'open', urnAddress: undefined });
    renderHook(() => useStakeCalldata(params));

    expect(mockState.rewardCalls[0]).toEqual({ urn: ZERO_ADDRESS });
    expect(mockState.delegateCalls[0]).toEqual({ urn: ZERO_ADDRESS });
  });

  it('emits NO selectFarm calldata when the fetched reward matches the selection', () => {
    // Fetched value is all-lowercase; selection is the checksummed same address —
    // the case-insensitive compare treats them equal, so no update is needed.
    mockState.urnSelectedReward = FARM;
    const params = hookParams({ urnAddress: URN, selectedRewardContract: getAddress(FARM) });

    const { result } = renderHook(() => useStakeCalldata(params));

    expect(result.current.calldata).toEqual(generateStakeCalldata(pureParams(params)));
    expect(result.current.calldata).toEqual([]);
  });

  it('emits selectFarm calldata when the fetched reward differs from the selection', () => {
    mockState.urnSelectedReward = FARM;
    const params = hookParams({ urnAddress: URN, selectedRewardContract: FARM2 });

    const { result } = renderHook(() => useStakeCalldata(params));

    expect(result.current.calldata).toEqual(generateStakeCalldata(pureParams(params)));
    expect(result.current.calldata).toHaveLength(1);
  });

  it('emits NO selectDelegate calldata when the fetched delegate matches the selection', () => {
    mockState.urnSelectedDelegate = DELEGATE;
    const params = hookParams({ urnAddress: URN, selectedDelegate: getAddress(DELEGATE) });

    const { result } = renderHook(() => useStakeCalldata(params));

    expect(result.current.calldata).toEqual(generateStakeCalldata(pureParams(params)));
    expect(result.current.calldata).toEqual([]);
  });

  it('emits selectDelegate calldata when the fetched delegate differs from the selection', () => {
    mockState.urnSelectedDelegate = DELEGATE;
    const params = hookParams({ urnAddress: URN, selectedDelegate: DELEGATE2 });

    const { result } = renderHook(() => useStakeCalldata(params));

    expect(result.current.calldata).toEqual(generateStakeCalldata(pureParams(params)));
    expect(result.current.calldata).toHaveLength(1);
  });

  it('equals generateStakeCalldata for a mixed manage scenario with fetched values folded in', () => {
    mockState.urnSelectedReward = FARM;
    mockState.urnSelectedDelegate = DELEGATE;
    const params = hookParams({
      urnAddress: URN,
      skyToLock: 1_000_000n,
      skyToFree: 500n,
      usdsToWipe: 200n,
      usdsToBorrow: 300n,
      selectedRewardContract: FARM2,
      selectedDelegate: DELEGATE2,
      rewardContractsToClaim: [FARM2, DELEGATE2],
      referralCode: 12345
    });

    const { result } = renderHook(() => useStakeCalldata(params));

    expect(result.current.calldata).toEqual(generateStakeCalldata(pureParams(params)));
  });

  it('memoizes: identical inputs across re-renders return the same calldata reference', () => {
    const params = hookParams({ urnAddress: URN, skyToLock: 1_000_000n });

    const { result, rerender } = renderHook(() => useStakeCalldata(params));
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});
