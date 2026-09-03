/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const REWARD_CONTRACT = '0x0650CAF159C5A49f711e8169D4336ECB9b950275' as const;
const DELEGATE = '0x4444444444444444444444444444444444444444' as const;
const URN_INDEX = 3n;

type RawCall = {
  to: `0x${string}`;
  abi?: readonly unknown[];
  functionName?: string;
  args?: readonly unknown[];
  data?: `0x${string}`;
};

// Shared mutable state for the module mocks below. `vi.hoisted` runs before the
// `vi.mock` factories so they can close over it.
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

// Capture the exact Call[] the engine hands to the transaction flow — the only
// channel through which calldata leaves useBatchStakeMulticall. The engine
// itself is left unmodified (landmine #1: allowance derivation stays inside it).
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

// Control the allowances the engine reads.
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

// The next urn index for a brand-new position.
// SKY spot for the enhanced-screening USD notional (APP-517).
vi.mock('@/hooks/prices/useSkyPrice', () => ({
  useSkyPrice: () => ({ data: 50000000000000000n, priceString: '0.05', isLoading: false, error: null })
}));

vi.mock('@/hooks/stake/useCurrentUrnIndex', () => ({
  useCurrentUrnIndex: () => ({ data: URN_INDEX, error: null, isLoading: false, mutate: () => undefined })
}));

// useStakeCalldata's live urn reads — a new urn has neither selection.
vi.mock('@/hooks/stake/useUrnSelectedRewardContract', () => ({
  useUrnSelectedRewardContract: () => ({ data: undefined, error: null, isLoading: false })
}));
vi.mock('@/hooks/stake/useUrnSelectedVoteDelegate', () => ({
  useUrnSelectedVoteDelegate: () => ({ data: undefined, error: null, isLoading: false })
}));

// Reward-token symbol for the analytics payload.
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

import { REFERRAL_CODE } from '@/lib/constants';
import { generateStakeCalldata } from './useStakeCalldata';
import { useStakeLaunch, buildStakeOpenSteps } from './useStakeLaunch';

const SKY_AMOUNT = parseUnits('100000', 18);
const USDS_AMOUNT = parseUnits('30000', 18);
const HAS_ALLOWANCE = parseUnits('100000000', 18);

const renderLaunch = (
  params: Partial<Parameters<typeof useStakeLaunch>[0]> = {}
): ReturnType<typeof renderHook<ReturnType<typeof useStakeLaunch>, unknown>> =>
  renderHook(() =>
    useStakeLaunch({
      skyToLock: SKY_AMOUNT,
      usdsToBorrow: USDS_AMOUNT,
      selectedRewardContract: REWARD_CONTRACT,
      selectedDelegate: DELEGATE,
      enabled: true,
      ...params
    })
  );

/** The open-flow calldata set the seam must feed the engine, byte-for-byte. */
const expectedCalldata = (usdsToBorrow: bigint, delegate?: `0x${string}`) =>
  generateStakeCalldata({
    flow: 'open',
    ownerAddress: TEST_ADDRESS,
    urnIndex: URN_INDEX,
    urnAddress: undefined,
    skyToLock: SKY_AMOUNT,
    skyToFree: 0n,
    usdsToWipe: 0n,
    wipeAll: false,
    usdsToBorrow,
    selectedRewardContract: REWARD_CONTRACT,
    selectedDelegate: delegate,
    urnSelectedRewardContract: undefined,
    urnSelectedVoteDelegate: undefined,
    rewardContractsToClaim: undefined,
    restakeSkyRewards: false,
    restakeSkyAmount: 0n,
    referralCode: REFERRAL_CODE
  });

describe('buildStakeOpenSteps', () => {
  it('derives the step list from the calldata set (A-Q3: delegate shown honestly)', () => {
    expect(buildStakeOpenSteps({ needsSkyAllowance: true, hasBorrow: true, hasDelegate: true })).toEqual([
      { label: 'Approve', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been approved." },
      { label: 'Stake', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been staked." },
      { label: 'Borrow', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been borrowed." },
      'Delegate voting power'
    ]);
    expect(buildStakeOpenSteps({ needsSkyAllowance: false, hasBorrow: false, hasDelegate: false })).toEqual([
      { label: 'Stake', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been staked." }
    ]);
    expect(buildStakeOpenSteps({ needsSkyAllowance: true, hasBorrow: false, hasDelegate: false })).toEqual([
      { label: 'Approve', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been approved." },
      { label: 'Stake', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been staked." }
    ]);
  });
});

describe('useStakeLaunch — calldata parity with the F1 seam', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.capturedEnabled = undefined;
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.skyAllowance = 0n;
    h.usdsAllowance = HAS_ALLOWANCE;
  });
  afterEach(cleanup);

  it('feeds the engine approve(SKY) + multicall(calldata) without an existing allowance', () => {
    renderLaunch();

    const calls = h.capturedCalls as RawCall[];
    expect(calls).toHaveLength(2);
    expect(calls[0].functionName).toBe('approve');
    expect(calls[1].functionName).toBe('multicall');
    expect(calls[1].args?.[0]).toEqual(expectedCalldata(USDS_AMOUNT, DELEGATE));
  });

  it('feeds a bare multicall when the SKY allowance already covers the lock', () => {
    h.skyAllowance = HAS_ALLOWANCE;
    renderLaunch();

    const calls = h.capturedCalls as RawCall[];
    expect(calls.map(call => call.functionName)).toEqual(['multicall']);
  });

  it('omits draw/delegate calldata when borrow and delegation are off', () => {
    renderLaunch({ usdsToBorrow: 0n, selectedDelegate: undefined });

    const calls = h.capturedCalls as RawCall[];
    const multicall = calls[calls.length - 1];
    expect(multicall.args?.[0]).toEqual(expectedCalldata(0n, undefined));
  });

  it('keeps the engine disabled until the form is valid', () => {
    renderLaunch({ enabled: false });
    expect(h.capturedEnabled).toBe(false);
  });
});

describe('useStakeLaunch — launch() config', () => {
  beforeEach(() => {
    h.capturedCalls = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.skyAllowance = 0n;
    h.usdsAllowance = HAS_ALLOWANCE;
  });
  afterEach(cleanup);

  it('opens the confirm modal with stake analytics and the derived steps', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = h.launchMock.mock.calls[0][0];
    expect(config.title).toBe('Confirm');
    expect(config.transactionTitle).toBe('Confirm your transaction');
    expect(config.steps).toEqual([
      { label: 'Approve', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been approved." },
      { label: 'Stake', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been staked." },
      { label: 'Borrow', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been borrowed." },
      'Delegate voting power'
    ]);
    expect(config.analytics.widgetName).toBe('stake');
    expect(config.analytics.flow).toBe('open');
    expect(config.analytics.action).toBe('multicall');
  });

  it('carries the legacy stakeData analytics shape', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch());

    const data = h.launchMock.mock.calls[0][0].analytics.data;
    // Legacy parity: the open flow's stakeData carries NO urnIndex (the widget
    // only passes activeUrn?.urnIndex, which is undefined when opening).
    expect(data.urnIndex).toBeUndefined();
    expect(data).toMatchObject({
      module: 'stake',
      assetSymbol: 'SKY',
      borrowSymbol: 'USDS',
      selectedRewardContract: REWARD_CONTRACT,
      selectedRewardSymbol: 'SKY',
      isDelegating: true,
      isBatchTx: false,
      amount: 100000,
      stakeAction: 'stake',
      borrowAmount: 30000,
      borrowAction: 'borrow'
    });
  });

  it('routes onConfirm to the engine execute', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch());

    h.launchMock.mock.calls[0][0].onConfirm();
    expect(h.mockExecute).toHaveBeenCalledTimes(1);
  });

  it('uses the design result toasts: position-open for borrow, amount-staked for stake-only', () => {
    const withBorrow = renderLaunch();
    act(() => withBorrow.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].toast.success).toBe('The position is now open!');
    withBorrow.unmount();
    h.launchMock.mockClear();

    const stakeOnly = renderLaunch({ usdsToBorrow: 0n, selectedDelegate: undefined });
    act(() => stakeOnly.result.current.launch());
    expect(h.launchMock.mock.calls[0][0].toast.success).toBe('100,000 SKY staked!');
    stakeOnly.unmount();
  });

  it('reuses the legacy getStakeSubtitle msgids for the lifecycle subtitles', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch());

    const subtitles = h.launchMock.mock.calls[0][0].subtitles;
    expect(subtitles.loading).toBe(
      'Your transaction is being processed on the blockchain to create your position. Please wait.'
    );
    expect(subtitles.success).toBe(
      "You've borrowed 30,000 USDS by staking 100,000 SKY. Your new position is open."
    );
    expect(subtitles.error).toBe('An error occurred while opening your position');
  });
});
