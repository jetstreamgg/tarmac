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
import { getAddress } from 'viem';
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

// ---------------------------------------------------------------------------
// Combinatorial golden-master matrix (headline AC of this slice).
//
// The naive full cross-product of every dimension the ticket lists —
//   flow(2) · skyToLock(2) · skyToFree(2) · usdsToBorrow(2) · usdsToWipe(2) ·
//   wipeAll(2) · farm(4) · delegate(3) · claim(4) · restake(3) · referralCode(2)
// — is 18,432 combinations. We do NOT enumerate all of them: the calldata
// assembler (`context.tsx:296-408` / `generateStakeCalldata`) drops each
// computed element into a FIXED slot of a static array and then
// `.filter(Boolean)`s the whole thing, so the presence and encoding of any one
// element are independent of every other (the sole cross-term is lock's restake
// addend, covered by the restake dimension in Matrix B). Because of that
// fixed-slot independence, the UNION of two orthogonal full-factorial
// sub-matrices exercises every ordering + gating interaction the full product
// would, deterministically and with no randomness:
//
//   Matrix A — every amount/wipeAll combination × flow (selections/claims/restake
//              held empty): proves amount-derived ordering + wipe/wipeAll gating.
//   Matrix B — every selection/claim/restake/referralCode combination × flow,
//              with ALL amounts non-zero so selection/claim calldata is ordered
//              against present amount calldata: proves gating + the full manage
//              ordering (repay→free→claims→selectFarm→selectDelegate→lock→draw).
//   Matrix C — wipeAll × usdsToWipe × selections spot-check: confirms the wipeAll
//              front-slot is independent of the selection dimensions (the one
//              amount×selection interaction Matrix B fixes amounts for).
//
// Cap: 64 + 576 + 48 = 688 cases (stated here per the AC). "Partial amounts +
// partial selections" combos not enumerated are structurally guaranteed by the
// per-element fixed-slot filtering above. Each case renders a FRESH legacy
// provider (the proven `legacyOutput` path) so restake/gating state cannot bleed
// between cases; `it.each` names each case with its serialized combo so a
// failure points straight at the offending inputs.
// ---------------------------------------------------------------------------

type MatrixDim = {
  tag: string;
  over: Partial<GenerateStakeCalldataParams>;
  flowEnum?: StakeFlow;
};

type MatrixCase = {
  label: string;
  params: GenerateStakeCalldataParams;
  flowEnum: StakeFlow;
};

/**
 * Deterministic cartesian product of named dimensions. Merges each dimension's
 * `over` (later dims win) onto `base`, concatenates the `tag`s into a debuggable
 * label, and carries the flow dimension's `flowEnum` through to drive the legacy
 * oracle. No randomness — pure enumeration in declaration order.
 */
function product(dims: MatrixDim[][], base: Partial<GenerateStakeCalldataParams> = {}): MatrixCase[] {
  let combos: MatrixDim[][] = [[]];
  for (const dim of dims) {
    combos = combos.flatMap(prefix => dim.map(d => [...prefix, d]));
  }
  return combos.map(combo => {
    const over = combo.reduce<Partial<GenerateStakeCalldataParams>>((acc, d) => ({ ...acc, ...d.over }), {
      ...base
    });
    const flowDim = combo.find(d => d.flowEnum !== undefined);
    return {
      label: combo.map(d => d.tag).join(' '),
      params: scenario(over),
      flowEnum: flowDim!.flowEnum!
    };
  });
}

const flowDim: MatrixDim[] = [
  { tag: 'open', over: { flow: 'open', urnAddress: undefined }, flowEnum: StakeFlow.OPEN },
  { tag: 'manage', over: { flow: 'manage', urnAddress: URN }, flowEnum: StakeFlow.MANAGE }
];

const skyToLockDim: MatrixDim[] = [
  { tag: 'lock=0', over: { skyToLock: 0n } },
  { tag: 'lock+', over: { skyToLock: 1_000_000n } }
];
const skyToFreeDim: MatrixDim[] = [
  { tag: 'free=0', over: { skyToFree: 0n } },
  { tag: 'free+', over: { skyToFree: 500_000n } }
];
const usdsToBorrowDim: MatrixDim[] = [
  { tag: 'draw=0', over: { usdsToBorrow: 0n } },
  { tag: 'draw+', over: { usdsToBorrow: 300_000n } }
];
const usdsToWipeDim: MatrixDim[] = [
  { tag: 'wipe=0', over: { usdsToWipe: 0n } },
  { tag: 'wipe+', over: { usdsToWipe: 100_000n } }
];
const wipeAllDim: MatrixDim[] = [
  { tag: 'wipeAll=false', over: { wipeAll: false } },
  { tag: 'wipeAll=true', over: { wipeAll: true } }
];

// Selection dimensions read against a fixed urn baseline (FARM_LC / DELEGATE_LC).
// 'same' uses the EIP-55 checksummed (mixed-case) form of the baseline so the
// case-insensitive gating compare is exercised while the address stays encodable
// by viem when it IS emitted (OPEN flow) — an all-uppercase variant like FARM_UC
// fails viem's checksum validation the moment `selectFarm` gets encoded. In OPEN
// flow the urn baseline is ignored by the predicates (they short-circuit on
// `!urnAddress`), so these still cover the open-flow gating branch.
const FARM_SAME = getAddress(FARM_LC); // mixed-case, case-insensitively === FARM_LC
const DELEGATE_SAME = getAddress(DELEGATE_LC);
const farmDim: MatrixDim[] = [
  { tag: 'farm:unset', over: { selectedRewardContract: undefined } },
  { tag: 'farm:same', over: { selectedRewardContract: FARM_SAME } },
  { tag: 'farm:diff', over: { selectedRewardContract: FARM2 } },
  { tag: 'farm:zero', over: { selectedRewardContract: ZERO_ADDRESS } }
];
const delegateDim: MatrixDim[] = [
  { tag: 'del:unset', over: { selectedDelegate: undefined } },
  { tag: 'del:same', over: { selectedDelegate: DELEGATE_SAME } },
  { tag: 'del:diff', over: { selectedDelegate: DELEGATE2 } }
];
const claimDim: MatrixDim[] = [
  { tag: 'claim:undef', over: { rewardContractsToClaim: undefined } },
  { tag: 'claim:empty', over: { rewardContractsToClaim: [] } },
  { tag: 'claim:one', over: { rewardContractsToClaim: [REWARD_A] } },
  { tag: 'claim:two', over: { rewardContractsToClaim: [REWARD_A, REWARD_B] } }
];
// restake:on0 → the legacy effect resets restakeSkyRewards to false (claimBalance
// 0n); the pure function keeps the flag but adds 0n — both must agree on lock.
const restakeDim: MatrixDim[] = [
  { tag: 'restake:off', over: { restakeSkyRewards: false, restakeSkyAmount: 0n } },
  { tag: 'restake:on+', over: { restakeSkyRewards: true, restakeSkyAmount: 250_000n } },
  { tag: 'restake:on0', over: { restakeSkyRewards: true, restakeSkyAmount: 0n } }
];
const refcodeDim: MatrixDim[] = [
  { tag: 'ref:0', over: { referralCode: 0 } },
  { tag: 'ref:12345', over: { referralCode: 12345 } }
];

// Matrix A — full factorial of the five amount/wipeAll dimensions × flow (64).
const matrixA = product([flowDim, skyToLockDim, skyToFreeDim, usdsToBorrowDim, usdsToWipeDim, wipeAllDim]);

// Matrix B — full factorial of selection/claim/restake/referralCode × flow (576),
// with every amount non-zero so selection/claim calldata is ordered against
// present repay/free/lock/draw calldata.
const matrixB = product([flowDim, farmDim, delegateDim, claimDim, restakeDim, refcodeDim], {
  skyToLock: 1_000_000n,
  skyToFree: 200_000n,
  usdsToBorrow: 400_000n,
  usdsToWipe: 100_000n,
  wipeAll: false,
  urnSelectedRewardContract: FARM_LC,
  urnSelectedVoteDelegate: DELEGATE_LC
});

// Matrix C — wipeAll × usdsToWipe × selections × flow (48): wipeAll fixed true,
// confirming the wipeAll front-slot and the wipe-suppression-under-wipeAll are
// independent of the selection dimensions.
const matrixC = product([flowDim, usdsToWipeDim, farmDim, delegateDim], {
  skyToLock: 1_000_000n,
  skyToFree: 200_000n,
  usdsToBorrow: 400_000n,
  wipeAll: true,
  urnSelectedRewardContract: FARM_LC,
  urnSelectedVoteDelegate: DELEGATE_LC
});

describe('generateStakeCalldata — Matrix A: amounts × flow (full factorial)', () => {
  it.each(matrixA)('$label', ({ params, flowEnum }) => {
    expect(generateStakeCalldata(params)).toEqual(legacyOutput(params, flowEnum));
  });
});

describe('generateStakeCalldata — Matrix B: selections/claims/restake/referralCode × flow', () => {
  it.each(matrixB)('$label', ({ params, flowEnum }) => {
    expect(generateStakeCalldata(params)).toEqual(legacyOutput(params, flowEnum));
  });
});

describe('generateStakeCalldata — Matrix C: wipeAll × usdsToWipe × selections × flow', () => {
  it.each(matrixC)('$label', ({ params, flowEnum }) => {
    expect(generateStakeCalldata(params)).toEqual(legacyOutput(params, flowEnum));
  });
});

describe('generateStakeCalldata — matrix cardinality guard', () => {
  it('enumerates the stated 688-case cap (64 + 576 + 48) deterministically', () => {
    expect(matrixA).toHaveLength(64);
    expect(matrixB).toHaveLength(576);
    expect(matrixC).toHaveLength(48);
    // Labels are unique per matrix — the serialized combo is a stable case id.
    expect(new Set(matrixA.map(c => c.label)).size).toBe(matrixA.length);
    expect(new Set(matrixB.map(c => c.label)).size).toBe(matrixB.length);
    expect(new Set(matrixC.map(c => c.label)).size).toBe(matrixC.length);
  });
});
