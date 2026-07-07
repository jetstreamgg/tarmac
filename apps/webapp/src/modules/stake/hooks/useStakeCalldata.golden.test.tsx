/// <reference types="vite/client" />

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { i18n } from '@lingui/core';

i18n.load('en', {});
i18n.activate('en');

// Mutable mock state shared with the hoisted `vi.mock` factory below. Each test
// (via `beforeEach`) resets it to the OPEN-flow defaults (everything empty), and
// MANAGE scenarios populate it before rendering the legacy provider so the
// gating predicates and the restake effect see controlled on-chain values.
const mockState = vi.hoisted(() => ({
  urnSelectedReward: undefined as `0x${string}` | undefined,
  urnSelectedDelegate: undefined as `0x${string}` | undefined,
  rewardClaims: undefined as
    | Array<{ contractAddress: `0x${string}`; claimBalance: bigint; rewardSymbol: string }>
    | undefined,
  rewardContracts: undefined as Array<{ contractAddress: `0x${string}` }> | undefined
}));

// Golden master: mock ONLY the *data* hooks the legacy provider wires itself,
// keeping every `getStake*Calldata` encoder REAL (pure viem `encodeFunctionData`,
// no network). This is what lets us assert byte-identical `Hex[]` output between
// the legacy context and the extracted pure function.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useRewardContractsToClaim: () => ({ data: mockState.rewardClaims, isLoading: false }),
    useStakeRewardContracts: () => ({ data: mockState.rewardContracts, isLoading: false, error: null }),
    useStakeUrnSelectedRewardContract: () => ({ data: mockState.urnSelectedReward, refetch: () => {} }),
    useStakeUrnSelectedVoteDelegate: () => ({ data: mockState.urnSelectedDelegate, refetch: () => {} })
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

import {
  getStakeDrawCalldata,
  getStakeFreeCalldata,
  getStakeGetRewardCalldata,
  getStakeLockCalldata,
  getStakeSelectDelegateCalldata,
  getStakeSelectRewardContractCalldata,
  getStakeWipeAllCalldata,
  getStakeWipeCalldata,
  ZERO_ADDRESS
} from '@/hooks';
import {
  StakeModuleWidgetContext,
  StakeModuleWidgetProvider
} from '@/widgets/StakeModuleWidget/context/context';
import { WidgetContext, WidgetProvider } from '@/widgets/context/WidgetContext';
import { StakeFlow } from '@/widgets/StakeModuleWidget/lib/constants';
import { generateStakeCalldata, type GenerateStakeCalldataParams } from './useStakeCalldata';

const OWNER = '0x000000000000000000000000000000000000beef' as `0x${string}`;
const URN = '0x00000000000000000000000000000000000000aa' as `0x${string}`;
const FARM = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const FARM2 = '0x3333333333333333333333333333333333333333' as `0x${string}`;
const DELEGATE = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const DELEGATE2 = '0x4444444444444444444444444444444444444444' as `0x${string}`;
const REWARD_A = '0x5555555555555555555555555555555555555555' as `0x${string}`;
const REWARD_B = '0x6666666666666666666666666666666666666666' as `0x${string}`;
const SKY_FARM = '0x7777777777777777777777777777777777777777' as `0x${string}`;
// Same address, different casing — exercises the case-insensitive gating compare.
const FARM_LC = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
const FARM_UC = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as `0x${string}`;
const DELEGATE_LC = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`;
const DELEGATE_UC = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as `0x${string}`;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <WidgetProvider locale="en">
      <StakeModuleWidgetProvider>{children}</StakeModuleWidgetProvider>
    </WidgetProvider>
  );
}

function renderStakeContexts() {
  return renderHook(
    () => ({
      stake: React.useContext(StakeModuleWidgetContext),
      widget: React.useContext(WidgetContext)
    }),
    { wrapper }
  );
}

/** Defaults for a scenario; override only the dimensions a case exercises. */
function scenario(overrides: Partial<GenerateStakeCalldataParams>): GenerateStakeCalldataParams {
  return {
    flow: 'open',
    ownerAddress: OWNER,
    urnIndex: 0n,
    urnAddress: undefined,
    skyToLock: 0n,
    skyToFree: 0n,
    usdsToWipe: 0n,
    wipeAll: false,
    usdsToBorrow: 0n,
    selectedRewardContract: undefined,
    selectedDelegate: undefined,
    urnSelectedRewardContract: undefined,
    urnSelectedVoteDelegate: undefined,
    rewardContractsToClaim: undefined,
    restakeSkyRewards: false,
    restakeSkyAmount: 0n,
    referralCode: 0,
    ...overrides
  };
}

/**
 * Drives the legacy `StakeModuleWidgetProvider` to reproduce `params` and returns
 * its `generateAllCalldata` output — the golden oracle. Populates the mocked data
 * hooks (`useStakeUrnSelected*`, `useRewardContractsToClaim`) so the legacy
 * gating predicates and the restake effect see the same on-chain values `params`
 * encodes, then flips the widget flow + drives every setter inside `act`.
 *
 * Restake note: the legacy provider's effect (`context.tsx:265-278`) OVERRIDES
 * `restakeSkyAmount` from `activeSkyReward.claimBalance` and resets
 * `restakeSkyRewards` to false when that balance is 0n. So a restake scenario is
 * driven by mocking a SKY reward claim of `restakeSkyAmount`, not by calling the
 * setter directly.
 */
function legacyOutput(params: GenerateStakeCalldataParams, flowEnum: StakeFlow): `0x${string}`[] {
  mockState.urnSelectedReward = params.urnSelectedRewardContract;
  mockState.urnSelectedDelegate = params.urnSelectedVoteDelegate;
  if (params.restakeSkyRewards) {
    mockState.rewardClaims = [
      { contractAddress: SKY_FARM, claimBalance: params.restakeSkyAmount, rewardSymbol: 'SKY' }
    ];
    mockState.rewardContracts = [{ contractAddress: SKY_FARM }];
  }

  const { result } = renderStakeContexts();
  act(() => {
    result.current.widget.setWidgetState(prev => ({ ...prev, flow: flowEnum }));
    if (params.urnAddress) {
      result.current.stake.setActiveUrn(
        { urnAddress: params.urnAddress, urnIndex: params.urnIndex },
        () => {}
      );
    }
    result.current.stake.setSkyToLock(params.skyToLock);
    result.current.stake.setSkyToFree(params.skyToFree);
    result.current.stake.setUsdsToWipe(params.usdsToWipe);
    result.current.stake.setWipeAll(params.wipeAll);
    result.current.stake.setUsdsToBorrow(params.usdsToBorrow);
    result.current.stake.setSelectedRewardContract(params.selectedRewardContract);
    result.current.stake.setSelectedDelegate(params.selectedDelegate);
    result.current.stake.setRewardContractsToClaim(params.rewardContractsToClaim);
    result.current.stake.setRestakeSkyRewards(params.restakeSkyRewards);
  });
  return result.current.stake.generateAllCalldata(params.ownerAddress, params.urnIndex, params.referralCode);
}

/** Convenience: legacy OPEN-flow oracle. */
function legacyOpenOutput(params: GenerateStakeCalldataParams): `0x${string}`[] {
  return legacyOutput(params, StakeFlow.OPEN);
}

/** Convenience: legacy MANAGE-flow oracle. */
function legacyManageOutput(params: GenerateStakeCalldataParams): `0x${string}`[] {
  return legacyOutput(params, StakeFlow.MANAGE);
}

beforeEach(() => {
  mockState.urnSelectedReward = undefined;
  mockState.urnSelectedDelegate = undefined;
  mockState.rewardClaims = undefined;
  mockState.rewardContracts = undefined;
});

describe('generateStakeCalldata — OPEN flow golden parity vs legacy context', () => {
  it('open + lock only', () => {
    const params = scenario({ flow: 'open', skyToLock: 1_000_000n });
    expect(generateStakeCalldata(params)).toEqual(legacyOpenOutput(params));
    expect(generateStakeCalldata(params).length).toBeGreaterThan(0);
  });

  it('open + lock + draw + farm + delegate (full OPEN scenario)', () => {
    const params = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      usdsToBorrow: 500_000n,
      selectedRewardContract: FARM,
      selectedDelegate: DELEGATE
    });
    const legacy = legacyOpenOutput(params);
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacy);
    // open, lock, draw, selectFarm, selectDelegate — five distinct calls
    expect(pure).toHaveLength(5);
  });

  it('open with a custom referralCode threads it into lock + selectFarm', () => {
    const params = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      selectedRewardContract: FARM,
      referralCode: 12345
    });
    expect(generateStakeCalldata(params)).toEqual(legacyOpenOutput(params));
  });

  it('open with the default-0 referralCode matches legacy', () => {
    const params = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      selectedRewardContract: FARM,
      referralCode: 0
    });
    expect(generateStakeCalldata(params)).toEqual(legacyOpenOutput(params));
  });

  it('emits the open calldata first when urnAddress is undefined (new position)', () => {
    const params = scenario({ flow: 'open', skyToLock: 1_000_000n });
    const pure = generateStakeCalldata(params);
    const legacy = legacyOpenOutput(params);
    // The legacy provider has no activeUrn in OPEN, so both begin with `open`.
    expect(pure[0]).toBe(legacy[0]);
    expect(pure).toEqual(legacy);
  });
});

describe('generateStakeCalldata — OPEN lock term (no isSkyRewardPosition guard)', () => {
  it('adds restakeSkyAmount to the lock term when restakeSkyRewards is on', () => {
    const withRestake = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      restakeSkyRewards: true,
      restakeSkyAmount: 250_000n
    });
    const withoutRestake = scenario({ flow: 'open', skyToLock: 1_250_000n });
    // Same total lock amount → identical encoded lock calldata.
    expect(generateStakeCalldata(withRestake)).toEqual(generateStakeCalldata(withoutRestake));
  });
});

describe('generateStakeCalldata — MANAGE flow ordering golden parity vs legacy context', () => {
  // Every MANAGE scenario manages an existing urn (activeUrn set).
  const manage = (overrides: Partial<GenerateStakeCalldataParams>) =>
    scenario({ flow: 'manage', urnAddress: URN, ...overrides });

  it('repay (wipe) only', () => {
    const params = manage({ usdsToWipe: 100_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([getStakeWipeCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 100_000n })]);
  });

  it('wipeAll only (calldata emitted regardless of usdsToWipe)', () => {
    const params = manage({ wipeAll: true, usdsToWipe: 0n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([getStakeWipeAllCalldata({ ownerAddress: OWNER, urnIndex: 0n })]);
  });

  it('free only', () => {
    const params = manage({ skyToFree: 500_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeFreeCalldata({ ownerAddress: OWNER, urnIndex: 0n, toAddress: OWNER, amount: 500_000n })
    ]);
  });

  it('repay + free — repay is ordered before free (position-safety rule)', () => {
    const params = manage({ usdsToWipe: 100_000n, skyToFree: 500_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeWipeCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 100_000n }),
      getStakeFreeCalldata({ ownerAddress: OWNER, urnIndex: 0n, toAddress: OWNER, amount: 500_000n })
    ]);
  });

  it('claim single reward', () => {
    const params = manage({ rewardContractsToClaim: [REWARD_A] });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeGetRewardCalldata({
        ownerAddress: OWNER,
        urnIndex: 0n,
        rewardContractAddress: REWARD_A,
        toAddress: OWNER
      })
    ]);
  });

  it('claim multiple rewards — input order preserved', () => {
    const params = manage({ rewardContractsToClaim: [REWARD_A, REWARD_B] });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeGetRewardCalldata({
        ownerAddress: OWNER,
        urnIndex: 0n,
        rewardContractAddress: REWARD_A,
        toAddress: OWNER
      }),
      getStakeGetRewardCalldata({
        ownerAddress: OWNER,
        urnIndex: 0n,
        rewardContractAddress: REWARD_B,
        toAddress: OWNER
      })
    ]);
  });

  it('claim + restake — restake adds to the lock term and lock sorts AFTER claims', () => {
    const params = manage({
      skyToLock: 1_000_000n,
      restakeSkyRewards: true,
      restakeSkyAmount: 250_000n,
      rewardContractsToClaim: [SKY_FARM]
    });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeGetRewardCalldata({
        ownerAddress: OWNER,
        urnIndex: 0n,
        rewardContractAddress: SKY_FARM,
        toAddress: OWNER
      }),
      // 1_000_000 + 250_000 restake, encoded as a single lock call after the claim
      getStakeLockCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 1_250_000n, refCode: 0 })
    ]);
  });

  it('change farm only — differing selection from urn emits selectFarm', () => {
    const params = manage({ selectedRewardContract: FARM2, urnSelectedRewardContract: FARM });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeSelectRewardContractCalldata({
        ownerAddress: OWNER,
        urnIndex: 0n,
        rewardContractAddress: FARM2,
        refCode: 0
      })
    ]);
  });

  it('change delegate only — differing selection from urn emits selectDelegate', () => {
    const params = manage({ selectedDelegate: DELEGATE2, urnSelectedVoteDelegate: DELEGATE });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeSelectDelegateCalldata({ ownerAddress: OWNER, urnIndex: 0n, delegateAddress: DELEGATE2 })
    ]);
  });

  it('add lock', () => {
    const params = manage({ skyToLock: 1_000_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeLockCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 1_000_000n, refCode: 0 })
    ]);
  });

  it('draw more', () => {
    const params = manage({ usdsToBorrow: 500_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeDrawCalldata({ ownerAddress: OWNER, urnIndex: 0n, toAddress: OWNER, amount: 500_000n })
    ]);
  });

  it('kitchen-sink manage — full ordering [wipe, free, claim, selectFarm, selectDelegate, lock, draw]', () => {
    const params = manage({
      usdsToWipe: 100_000n,
      skyToFree: 200_000n,
      rewardContractsToClaim: [REWARD_A],
      selectedRewardContract: FARM2,
      urnSelectedRewardContract: FARM,
      selectedDelegate: DELEGATE2,
      urnSelectedVoteDelegate: DELEGATE,
      skyToLock: 300_000n,
      usdsToBorrow: 400_000n
    });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeWipeCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 100_000n }),
      getStakeFreeCalldata({ ownerAddress: OWNER, urnIndex: 0n, toAddress: OWNER, amount: 200_000n }),
      getStakeGetRewardCalldata({
        ownerAddress: OWNER,
        urnIndex: 0n,
        rewardContractAddress: REWARD_A,
        toAddress: OWNER
      }),
      getStakeSelectRewardContractCalldata({
        ownerAddress: OWNER,
        urnIndex: 0n,
        rewardContractAddress: FARM2,
        refCode: 0
      }),
      getStakeSelectDelegateCalldata({ ownerAddress: OWNER, urnIndex: 0n, delegateAddress: DELEGATE2 }),
      getStakeLockCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 300_000n, refCode: 0 }),
      getStakeDrawCalldata({ ownerAddress: OWNER, urnIndex: 0n, toAddress: OWNER, amount: 400_000n })
    ]);
  });

  it('legacy CLAIM flow (widget flow !== OPEN) equals the pure manage output', () => {
    const params = scenario({
      flow: 'manage',
      urnAddress: URN,
      rewardContractsToClaim: [REWARD_A, REWARD_B]
    });
    // Legacy provider driven with StakeFlow.CLAIM must equal the pure `manage`
    // output — CLAIM is not OPEN, so it takes the manage ordering branch.
    expect(generateStakeCalldata(params)).toEqual(legacyOutput(params, StakeFlow.CLAIM));
  });
});

describe('generateStakeCalldata — MANAGE gating edge cases golden parity', () => {
  const manage = (overrides: Partial<GenerateStakeCalldataParams>) =>
    scenario({ flow: 'manage', urnAddress: URN, ...overrides });

  it('unchanged farm on existing urn (case-flipped) emits NO selectFarm', () => {
    const params = manage({ selectedRewardContract: FARM_UC, urnSelectedRewardContract: FARM_LC });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([]);
  });

  it('unchanged delegate on existing urn (case-flipped) emits NO selectDelegate', () => {
    const params = manage({ selectedDelegate: DELEGATE_UC, urnSelectedVoteDelegate: DELEGATE_LC });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([]);
  });

  it('undefined selection on existing urn with a set urn farm emits selectFarm with ZERO_ADDRESS', () => {
    const params = manage({ selectedRewardContract: undefined, urnSelectedRewardContract: FARM });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyManageOutput(params));
    expect(pure).toEqual([
      getStakeSelectRewardContractCalldata({
        ownerAddress: OWNER,
        urnIndex: 0n,
        rewardContractAddress: ZERO_ADDRESS,
        refCode: 0
      })
    ]);
  });

  it('new urn (open) + no selection emits neither selectFarm nor selectDelegate', () => {
    const params = scenario({ flow: 'open', skyToLock: 1_000_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacyOpenOutput(params));
    // open + lock only — no select* calls
    expect(pure).toHaveLength(2);
  });
});
