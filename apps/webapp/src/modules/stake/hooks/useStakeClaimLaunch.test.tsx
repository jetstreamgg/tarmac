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
const SKY_FARM = '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc' as const;
const SPK_FARM = '0x99cbc0e4e8427f53999b9e4a5d9b7ba6d8b4bb5b' as const;
const CURRENT_REWARD = SKY_FARM;
const CURRENT_DELEGATE = '0x5555555555555555555555555555555555555555' as const;
const URN_INDEX = 1n;

const SKY_CLAIM = parseUnits('22.9', 18);
const SPK_CLAIM = parseUnits('17.66', 18);
const HAS_ALLOWANCE = parseUnits('100000000', 18);

type RawCall = {
  to: `0x${string}`;
  functionName?: string;
  args?: readonly unknown[];
};
type CapturedFlow = { calls: RawCall[]; enabled: boolean | undefined; shouldUseBatch: boolean | undefined };

const h = vi.hoisted(() => ({
  flows: [] as { calls: unknown[]; enabled?: boolean; shouldUseBatch?: boolean }[],
  mockExecute: vi.fn(),
  launchMock: vi.fn(),
  skyAllowance: 0n as bigint | undefined,
  claims: [] as { contractAddress: `0x${string}`; claimBalance: bigint; rewardSymbol: string }[]
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

// Single capture point for BOTH engines: the plain-claim useTransactionFlow is
// called directly by the hook; the restake path reaches it through the real,
// unmodified useBatchStakeMulticall. Invocation order per render is fixed by
// the hook's own call order: plain first, restake engine second.
vi.mock('@/hooks/shared/useTransactionFlow', () => ({
  useTransactionFlow: (params: { calls: unknown[]; enabled?: boolean; shouldUseBatch?: boolean }) => {
    h.flows.push({ calls: params.calls, enabled: params.enabled, shouldUseBatch: params.shouldUseBatch });
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
    data: HAS_ALLOWANCE,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

vi.mock('@/hooks/stake/useUrnAddress', () => ({
  useUrnAddress: () => ({ data: URN_ADDRESS, error: null, isLoading: false })
}));
vi.mock('@/hooks/stake/useUrnSelectedRewardContract', () => ({
  useUrnSelectedRewardContract: () => ({ data: CURRENT_REWARD, error: null, isLoading: false })
}));
vi.mock('@/hooks/stake/useUrnSelectedVoteDelegate', () => ({
  useUrnSelectedVoteDelegate: () => ({ data: CURRENT_DELEGATE, error: null, isLoading: false })
}));
vi.mock('@/hooks/stake/useStakeRewardContracts', () => ({
  useStakeRewardContracts: () => ({
    data: [{ contractAddress: SKY_FARM }, { contractAddress: SPK_FARM }],
    error: null,
    isLoading: false
  })
}));
vi.mock('@/hooks/rewards/useRewardContractsToClaim', () => ({
  useRewardContractsToClaim: () => ({ data: h.claims, error: null, isLoading: false })
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

import { REFERRAL_CODE } from '@/lib/constants';
import { generateStakeCalldata } from './useStakeCalldata';
import { buildStakeClaimSteps, useStakeClaimLaunch } from './useStakeClaimLaunch';
import { makeStakeId } from '@/modules/claim/adapters/stakeAdapter';
import type { ClaimableReward } from '@/modules/claim/types';

const reward = (contract: `0x${string}`, symbol: string): ClaimableReward => ({
  id: makeStakeId(URN_INDEX, contract),
  source: 'stake',
  tokenName: 'Sky token',
  tokenSymbol: symbol,
  icon: null,
  formattedAmount: '0',
  amountUsd: 0,
  chainId: 1
});

const SKY_REWARD = reward(SKY_FARM, 'SKY');
const SPK_REWARD = reward(SPK_FARM, 'SPK');

const bothClaims = () => {
  h.claims = [
    { contractAddress: SKY_FARM, claimBalance: SKY_CLAIM, rewardSymbol: 'SKY' },
    { contractAddress: SPK_FARM, claimBalance: SPK_CLAIM, rewardSymbol: 'SPK' }
  ];
};

const renderLaunch = (params: Partial<Parameters<typeof useStakeClaimLaunch>[0]> = {}) =>
  renderHook(() =>
    useStakeClaimLaunch({
      urnIndex: URN_INDEX,
      selected: [SKY_REWARD, SPK_REWARD],
      enabled: true,
      ...params
    })
  );

/** [plain claim flow, restake engine flow] of the LAST render. */
const lastFlows = (): [CapturedFlow, CapturedFlow] => {
  const flows = h.flows.slice(-2) as CapturedFlow[];
  expect(flows).toHaveLength(2);
  return [flows[0], flows[1]];
};

/** The restake calldata the seam must feed the engine, byte-for-byte (AC). */
const expectedRestakeCalldata = (contracts: `0x${string}`[], restakeSkyAmount: bigint): `0x${string}`[] =>
  generateStakeCalldata({
    flow: 'manage',
    ownerAddress: TEST_ADDRESS,
    urnIndex: URN_INDEX,
    urnAddress: URN_ADDRESS,
    skyToLock: 0n,
    skyToFree: 0n,
    usdsToWipe: 0n,
    wipeAll: false,
    usdsToBorrow: 0n,
    selectedRewardContract: CURRENT_REWARD,
    selectedDelegate: CURRENT_DELEGATE,
    urnSelectedRewardContract: CURRENT_REWARD,
    urnSelectedVoteDelegate: CURRENT_DELEGATE,
    rewardContractsToClaim: contracts,
    restakeSkyRewards: true,
    restakeSkyAmount,
    referralCode: REFERRAL_CODE
  });

describe('buildStakeClaimSteps', () => {
  it('derives steps from the selection: Claim per token, then Restake SKY (UX 1050:23881)', () => {
    expect(
      buildStakeClaimSteps({ needsSkyAllowance: false, claimSymbols: ['SKY', 'SPK'], restake: false })
    ).toEqual([
      { label: 'Claim', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SPK' }
    ]);

    expect(
      buildStakeClaimSteps({ needsSkyAllowance: false, claimSymbols: ['SKY', 'SPK'], restake: true })
    ).toEqual([
      { label: 'Claim', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SPK' },
      { label: 'Restake', tokenSymbol: 'SKY' }
    ]);

    expect(buildStakeClaimSteps({ needsSkyAllowance: true, claimSymbols: ['SKY'], restake: true })).toEqual([
      { label: 'Approve', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SKY' },
      { label: 'Restake', tokenSymbol: 'SKY' }
    ]);

    // Plain claim never needs an approval: nothing is pulled from the owner.
    expect(buildStakeClaimSteps({ needsSkyAllowance: true, claimSymbols: ['SPK'], restake: false })).toEqual([
      { label: 'Claim', tokenSymbol: 'SPK' }
    ]);
  });
});

describe('useStakeClaimLaunch — engines', () => {
  beforeEach(() => {
    h.flows = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.skyAllowance = 0n;
    bothClaims();
  });
  afterEach(cleanup);

  it('feeds the plain claim one getReward Call per selected contract (D5 adapter shape)', () => {
    renderLaunch();

    const [plain] = lastFlows();
    expect(plain.calls.map(call => call.functionName)).toEqual(['getReward', 'getReward']);
    // The adapter round-trips contracts through its lowercase ids — harmless
    // (addresses are case-insensitive on-chain), locked in here.
    expect(plain.calls[0].args).toEqual([TEST_ADDRESS, URN_INDEX, SKY_FARM.toLowerCase(), TEST_ADDRESS]);
    expect(plain.calls[1].args).toEqual([TEST_ADDRESS, URN_INDEX, SPK_FARM, TEST_ADDRESS]);
    // Legacy claimAllRewards: "Always use batch transactions for this flow".
    expect(plain.shouldUseBatch).toBe(true);
    expect(plain.enabled).toBe(true);
  });

  it('feeds the restake engine approve(SKY, restakeAmount) + multicall of the golden calldata (AC)', () => {
    renderLaunch();

    const [, restake] = lastFlows();
    expect(restake.calls.map(call => call.functionName)).toEqual(['approve', 'multicall']);
    // PRD Decision 6 approval math: restake addend guarded by isSkyRewardPosition.
    expect(restake.calls[0].args?.[1]).toBe(SKY_CLAIM);
    // Byte-identical to the legacy restakeSkyRewards path: getReward× then lock,
    // in the SKY-first claim order, with NO select* legs (pass-through gating).
    expect(restake.calls[1].args?.[0]).toEqual(expectedRestakeCalldata([SKY_FARM, SPK_FARM], SKY_CLAIM));
  });

  it('skips the approve leg when the SKY allowance covers the restake amount', () => {
    h.skyAllowance = HAS_ALLOWANCE;
    renderLaunch();

    const [, restake] = lastFlows();
    expect(restake.calls.map(call => call.functionName)).toEqual(['multicall']);
  });

  it('orders the restake claims SKY-first even when the selection is not', () => {
    renderLaunch({ selected: [SPK_REWARD, SKY_REWARD] });

    const [, restake] = lastFlows();
    expect(restake.calls[1].args?.[0]).toEqual(expectedRestakeCalldata([SKY_FARM, SPK_FARM], SKY_CLAIM));
  });

  it('disables the restake engine when SKY is not in the selection', () => {
    renderLaunch({ selected: [SPK_REWARD] });

    const [plain, restake] = lastFlows();
    expect(plain.calls.map(call => call.functionName)).toEqual(['getReward']);
    expect(restake.enabled).toBe(false);
  });

  it('keeps both engines disabled until enabled', () => {
    renderLaunch({ enabled: false });

    const [plain, restake] = lastFlows();
    expect(plain.enabled).toBe(false);
    expect(restake.enabled).toBe(false);
  });
});

describe('useStakeClaimLaunch — launch() config', () => {
  beforeEach(() => {
    h.flows = [];
    h.mockExecute.mockClear();
    h.launchMock.mockClear();
    h.skyAllowance = 0n;
    bothClaims();
  });
  afterEach(cleanup);

  const launchConfig = () => h.launchMock.mock.calls[0][0];

  it('uses the legacy claim msgids and Confirm claim title (plain claim)', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch(false));

    const config = launchConfig();
    expect(config.title).toBe('Confirm claim');
    expect(config.transactionTitle).toBe('Claim your rewards');
    expect(config.subtitles.loading).toBe('Your claim is being processed on the blockchain. Please wait.');
    expect(config.subtitles.success).toBe('You’ve claimed your rewards');
    expect(config.steps).toEqual([
      { label: 'Claim', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SPK' }
    ]);
    expect(config.toast).toEqual({
      loading: 'Claiming rewards',
      success: 'Claim successful',
      error: 'Claim failed'
    });
  });

  it('adds Approve + Restake steps on the restake launch', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch(true));

    expect(launchConfig().steps).toEqual([
      { label: 'Approve', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SPK' },
      { label: 'Restake', tokenSymbol: 'SKY' }
    ]);
  });

  it('fires legacy claim analytics: claimAll for a multi-token plain claim', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch(false));

    const { analytics } = launchConfig();
    expect(analytics.widgetName).toBe('stake');
    expect(analytics.flow).toBe('manage');
    expect(analytics.action).toBe('claimAll');
    expect(analytics.data.urnIndex).toBe(1);
    expect(analytics.data.claimAction).toBe('claimAll');
    expect(analytics.data.claimedRewards).toEqual([
      { tokenSymbol: 'SKY', amount: 22.9, rewardContractAddress: SKY_FARM },
      { tokenSymbol: 'SPK', amount: 17.66, rewardContractAddress: SPK_FARM }
    ]);
    expect(analytics.data.restakeSkyRewards).toBeUndefined();
  });

  it('fires claimAllAndRestake with the restake amount on the restake launch', () => {
    const { result } = renderLaunch();
    act(() => result.current.launch(true));

    const { analytics } = launchConfig();
    expect(analytics.action).toBe('claimAllAndRestake');
    expect(analytics.data.restakeSkyAmount).toBe(22.9);
    expect(analytics.data.restakeSkyRewards).toBe(true);
  });

  it('fires claimAndRestake for a single-token restake', () => {
    h.claims = [{ contractAddress: SKY_FARM, claimBalance: SKY_CLAIM, rewardSymbol: 'SKY' }];
    const { result } = renderLaunch({ selected: [SKY_REWARD] });
    act(() => result.current.launch(true));

    expect(launchConfig().analytics.action).toBe('claimAndRestake');
    expect(launchConfig().steps).toEqual([
      { label: 'Approve', tokenSymbol: 'SKY' },
      { label: 'Claim', tokenSymbol: 'SKY' },
      { label: 'Restake', tokenSymbol: 'SKY' }
    ]);
  });

  it('exposes restake availability from the selection', () => {
    const withSky = renderLaunch();
    expect(withSky.result.current.restakeAvailable).toBe(true);

    const withoutSky = renderLaunch({ selected: [SPK_REWARD] });
    expect(withoutSky.result.current.restakeAvailable).toBe(false);
  });
});
