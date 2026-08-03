/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const URN_ADDRESS = '0x8888888888888888888888888888888888888888' as const;
const REWARD_CONTRACT = '0x0650CAF159C5A49f711e8169D4336ECB9b950275' as const;
const SKY_REWARD_CONTRACT = '0x1111111111111111111111111111111111111111' as const;
const SPK_REWARD_CONTRACT = '0x3333333333333333333333333333333333333333' as const;
const CURRENT_DELEGATE = '0x5555555555555555555555555555555555555555' as const;
const NEW_DELEGATE = '0x4444444444444444444444444444444444444444' as const;
const URN_INDEX = 1n;

type RawCall = {
  to: `0x${string}`;
  functionName?: string;
  args?: readonly unknown[];
};

const h = vi.hoisted(() => ({
  capturedCalls: [] as unknown[],
  capturedEnabled: undefined as boolean | undefined,
  mockExecute: vi.fn(),
  launchMock: vi.fn(),
  skyAllowance: 0n as bigint | undefined,
  usdsAllowance: 0n as bigint | undefined
}));

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

// Capture the Call[] the engine hands the transaction flow — the engine itself
// stays unmodified (allowance derivation stays inside it).
vi.mock('@/hooks/shared/useTransactionFlow', () => ({
  useTransactionFlow: (params: { calls: unknown[]; enabled?: boolean }) => {
    h.capturedCalls = params.calls;
    h.capturedEnabled = params.enabled;
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

vi.mock('@/hooks/stake/useStakeAllowance', () => ({
  useStakeSkyAllowance: () => ({
    data: h.skyAllowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  }),
  useStakeUsdsAllowance: () => ({
    data: h.usdsAllowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

// The managed urn's live selections — the gating baseline (M12).
vi.mock('@/hooks/stake/useUrnSelectedRewardContract', () => ({
  useUrnSelectedRewardContract: () => ({ data: REWARD_CONTRACT, error: null, isLoading: false })
}));
vi.mock('@/hooks/stake/useUrnSelectedVoteDelegate', () => ({
  useUrnSelectedVoteDelegate: () => ({ data: CURRENT_DELEGATE, error: null, isLoading: false })
}));

vi.mock('@/hooks/rewards/useRewardContractTokens', () => ({
  useRewardContractTokens: () => ({
    data: { rewardsToken: { symbol: 'SKY' } },
    error: null,
    isLoading: false
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

import { generateStakeCalldata, WIPE_BUFFER_DIVISOR, WIPE_BUFFER_MULTIPLIER } from './useStakeCalldata';
import { useStakeManageLaunch, buildStakeManageSteps } from './useStakeManageLaunch';

const SKY_FREE = parseUnits('55000', 18);
const USDS_WIPE = parseUnits('30000', 18);
const HAS_ALLOWANCE = parseUnits('100000000', 18);

const renderLaunch = (params: Partial<Parameters<typeof useStakeManageLaunch>[0]> = {}) =>
  renderHook(() =>
    useStakeManageLaunch({
      urnIndex: URN_INDEX,
      urnAddress: URN_ADDRESS,
      skyToLock: 0n,
      skyToFree: SKY_FREE,
      usdsToBorrow: 0n,
      usdsToWipe: USDS_WIPE,
      wipeAll: false,
      selectedDelegate: CURRENT_DELEGATE,
      enabled: true,
      ...params
    })
  );

/** The manage-flow calldata the seam must feed the engine, byte-for-byte. */
const expectedCalldata = (
  overrides: Partial<Parameters<typeof generateStakeCalldata>[0]> = {}
): `0x${string}`[] =>
  generateStakeCalldata({
    flow: 'manage',
    ownerAddress: TEST_ADDRESS,
    urnIndex: URN_INDEX,
    urnAddress: URN_ADDRESS,
    skyToLock: 0n,
    skyToFree: SKY_FREE,
    usdsToWipe: USDS_WIPE,
    wipeAll: false,
    usdsToBorrow: 0n,
    selectedRewardContract: REWARD_CONTRACT,
    selectedDelegate: CURRENT_DELEGATE,
    urnSelectedRewardContract: REWARD_CONTRACT,
    urnSelectedVoteDelegate: CURRENT_DELEGATE,
    rewardContractsToClaim: undefined,
    restakeSkyRewards: false,
    restakeSkyAmount: 0n,
    ...overrides
  });

describe('buildStakeManageSteps', () => {
  it('derives steps from the calldata set in manage execution order (B-Q2)', () => {
    expect(
      buildStakeManageSteps({
        needsSkyAllowance: true,
        needsUsdsAllowance: true,
        hasLock: false,
        hasFree: true,
        hasWipe: true,
        hasBorrow: false,
        hasDelegateChange: false
      })
    ).toEqual([
      { label: 'Approve', tokenSymbol: 'USDS' },
      { label: 'Repay', tokenSymbol: 'USDS' },
      { label: 'Withdraw', tokenSymbol: 'SKY' }
    ]);

    expect(
      buildStakeManageSteps({
        needsSkyAllowance: true,
        needsUsdsAllowance: false,
        hasLock: true,
        hasFree: false,
        hasWipe: false,
        hasBorrow: true,
        hasDelegateChange: true
      })
    ).toEqual([
      { label: 'Approve', tokenSymbol: 'SKY' },
      'Change delegate',
      { label: 'Stake', tokenSymbol: 'SKY' },
      { label: 'Borrow', tokenSymbol: 'USDS' }
    ]);

    expect(
      buildStakeManageSteps({
        needsSkyAllowance: false,
        needsUsdsAllowance: false,
        hasLock: false,
        hasFree: false,
        hasWipe: false,
        hasBorrow: true,
        hasDelegateChange: false
      })
    ).toEqual([{ label: 'Borrow', tokenSymbol: 'USDS' }]);
  });

  it('places one Claim {symbol} step per claimSymbols entry right after Withdraw SKY', () => {
    expect(
      buildStakeManageSteps({
        needsSkyAllowance: false,
        needsUsdsAllowance: false,
        hasLock: false,
        hasFree: true,
        hasWipe: false,
        hasBorrow: false,
        hasDelegateChange: false,
        claimSymbols: ['SKY', 'SPK']
      })
    ).toEqual([
      { label: 'Withdraw', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SPK' }
    ]);

    // No claimSymbols — untouched (no Claim steps at all).
    expect(
      buildStakeManageSteps({
        needsSkyAllowance: false,
        needsUsdsAllowance: false,
        hasLock: false,
        hasFree: true,
        hasWipe: false,
        hasBorrow: false,
        hasDelegateChange: false
      })
    ).toEqual([{ label: 'Withdraw', tokenSymbol: 'SKY' }]);
  });
});

describe('useStakeManageLaunch — calldata parity with the F1 seam', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.capturedEnabled = undefined;
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.skyAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = 0n;
  });
  afterEach(cleanup);

  it('feeds approve(USDS) + multicall for withdraw+repay without a USDS allowance', () => {
    renderLaunch();

    const calls = h.capturedCalls as RawCall[];
    expect(calls).toHaveLength(2);
    expect(calls[0].functionName).toBe('approve');
    expect(calls[1].functionName).toBe('multicall');
    expect(calls[1].args?.[0]).toEqual(expectedCalldata());
  });

  it('buffers the wipeAll USDS approval by 100005/100000 (M11)', () => {
    renderLaunch({ wipeAll: true });

    const approve = (h.capturedCalls as RawCall[])[0];
    expect(approve.functionName).toBe('approve');
    expect(approve.args?.[1]).toBe((USDS_WIPE * WIPE_BUFFER_MULTIPLIER) / WIPE_BUFFER_DIVISOR);

    const multicall = (h.capturedCalls as RawCall[])[1];
    expect(multicall.args?.[0]).toEqual(expectedCalldata({ wipeAll: true }));
  });

  it('emits no reward or delegate calldata when nothing changed (M12)', () => {
    h.usdsAllowance = HAS_ALLOWANCE;
    renderLaunch();

    const calls = h.capturedCalls as RawCall[];
    expect(calls.map(call => call.functionName)).toEqual(['multicall']);
    // wipe + free only — no selectRewardContract / selectVoteDelegate legs.
    expect(calls[0].args?.[0]).toHaveLength(2);
  });

  it('emits the delegate leg when the staged delegate differs', () => {
    h.usdsAllowance = HAS_ALLOWANCE;
    renderLaunch({ selectedDelegate: NEW_DELEGATE, skyToFree: 0n, usdsToWipe: 0n });

    // The unmodified engine unwraps a single-entry calldata set into a direct
    // call (no multicall wrapper) — worth locking in: the delegate-only flow is
    // one plain selectVoteDelegate transaction.
    const calls = h.capturedCalls as RawCall[];
    expect(calls.map(call => call.functionName)).toEqual(['selectVoteDelegate']);
    // The seam still produced exactly one calldata entry for it.
    expect(expectedCalldata({ selectedDelegate: NEW_DELEGATE, skyToFree: 0n, usdsToWipe: 0n })).toHaveLength(
      1
    );
  });

  it('keeps the engine disabled until the form is valid', () => {
    renderLaunch({ enabled: false });
    expect(h.capturedEnabled).toBe(false);
  });

  it('threads rewardContractsToClaim into the calldata fed to the engine', () => {
    renderLaunch({ rewardContractsToClaim: [SKY_REWARD_CONTRACT, SPK_REWARD_CONTRACT] });

    const multicall = (h.capturedCalls as RawCall[])[1];
    expect(multicall.args?.[0]).toEqual(
      expectedCalldata({ rewardContractsToClaim: [SKY_REWARD_CONTRACT, SPK_REWARD_CONTRACT] })
    );
  });

  it('leaves the calldata byte-for-byte identical without the new params (default undefined)', () => {
    renderLaunch();

    const multicall = (h.capturedCalls as RawCall[])[1];
    expect(multicall.args?.[0]).toEqual(expectedCalldata());
  });
});

describe('useStakeManageLaunch — launch() config', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.skyAllowance = HAS_ALLOWANCE;
    h.usdsAllowance = 0n;
  });
  afterEach(cleanup);

  it('titles the manage confirm per the staged action set (M7)', () => {
    const withdrawRepay = renderLaunch();
    act(() => withdrawRepay.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].title).toBe('Confirm');
    expect(h.launchMock.mock.calls[0][0].transactionTitle).toBe('Confirm the change in your position');
    withdrawRepay.unmount();
    h.launchMock.mockClear();

    const borrowOnly = renderLaunch({ skyToFree: 0n, usdsToWipe: 0n, usdsToBorrow: USDS_WIPE });
    act(() => borrowOnly.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].title).toBe('Confirm borrow');
    borrowOnly.unmount();
    h.launchMock.mockClear();

    const delegateOnly = renderLaunch({ skyToFree: 0n, usdsToWipe: 0n, selectedDelegate: NEW_DELEGATE });
    act(() => delegateOnly.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].title).toBe('Confirm delegate change');
    delegateOnly.unmount();
  });

  it('derives the withdraw+repay steps from the calldata set, not the stale mock (M6)', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch());
    expect(h.launchMock.mock.calls[0][0].steps).toEqual([
      { label: 'Approve', tokenSymbol: 'USDS' },
      { label: 'Repay', tokenSymbol: 'USDS' },
      { label: 'Withdraw', tokenSymbol: 'SKY' }
    ]);
  });

  it('orders bundled claim steps after Withdraw SKY (recovery launch shape)', () => {
    h.usdsAllowance = HAS_ALLOWANCE;
    const { result } = renderLaunch({
      usdsToWipe: 0n,
      rewardContractsToClaim: [SKY_REWARD_CONTRACT, SPK_REWARD_CONTRACT],
      claimSymbols: ['SKY', 'SPK']
    });
    act(() => result.current.launch());
    expect(h.launchMock.mock.calls[0][0].steps).toEqual([
      { label: 'Withdraw', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SPK' }
    ]);
  });

  it('carries the legacy manage stakeData analytics shape (M15)', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch());

    const { analytics } = h.launchMock.mock.calls[0][0];
    expect(analytics.widgetName).toBe('stake');
    expect(analytics.flow).toBe('manage');
    expect(analytics.action).toBe('multicall');
    expect(analytics.data).toMatchObject({
      module: 'stake',
      assetSymbol: 'SKY',
      borrowSymbol: 'USDS',
      urnIndex: 1,
      isDelegating: false,
      isBatchTx: false,
      amount: -55000,
      stakeAction: 'unstake',
      borrowAmount: -30000,
      borrowAction: 'repay'
    });
  });

  it('reuses the legacy MANAGE msgids for subtitles and flags the exit wording', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch());

    const { subtitles, toast } = h.launchMock.mock.calls[0][0];
    expect(subtitles.loading).toBe(
      'Your transaction is being processed on the blockchain to change your position. Please wait.'
    );
    // Legacy quirk preserved: the free+wipe success copy says "exit" even for a
    // partial withdraw+repay (getStakeSubtitle branches on presence, not size).
    expect(subtitles.success).toBe(
      "You've unstaked 55,000 SKY and repaid 30,000 USDS to exit your position."
    );
    expect(subtitles.error).toBe('An error occurred while changing your position');
    expect(toast).toEqual({
      loading: 'Changing position',
      success: 'Your position is updated!',
      error: 'Failed to change the position'
    });
  });

  it('routes onConfirm to the live engine execute', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch());
    h.launchMock.mock.calls[0][0].onConfirm();
    expect(h.mockExecute).toHaveBeenCalledTimes(1);
  });
});
