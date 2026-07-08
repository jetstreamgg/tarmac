/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';
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
import { getAddress } from 'viem';
import { generateStakeCalldata, type GenerateStakeCalldataParams } from './useStakeCalldata';
import goldenFixturesRaw from './useStakeCalldata.golden.fixtures.json?raw';

// ---------------------------------------------------------------------------
// Golden master, fixture form (F7).
//
// Until the F7 parity flip this suite asserted `generateStakeCalldata` against
// the LIVE legacy oracle — a rendered `StakeModuleWidgetProvider` whose
// `generateAllCalldata` was driven through its setters per scenario. F7 deletes
// the legacy widget, so the oracle's outputs were captured (GOLDEN_CAPTURE run,
// same commit, all 724 assertions green — i.e. legacy === pure, byte-identical)
// into `useStakeCalldata.golden.fixtures.json`, keyed by the serialized scenario
// params. The suite now replays the identical scenario set against those frozen
// bytes. The fixtures are NOT regenerable — that is the point: they are the
// legacy widget's exact output, outliving its deletion.
// ---------------------------------------------------------------------------

const goldenFixtures: Record<string, `0x${string}`[]> = JSON.parse(goldenFixturesRaw);

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
 * Serialization of a scenario's full param set — the fixture key. MUST stay
 * byte-identical to the `goldenKey` used by the capture run, or every lookup
 * misses. Optional fields serialize as `·` so `undefined` and set values can
 * never collide.
 */
function goldenKey(p: GenerateStakeCalldataParams): string {
  const opt = (a?: string) => a ?? '·';
  return [
    p.flow,
    p.ownerAddress,
    p.urnIndex,
    opt(p.urnAddress),
    p.skyToLock,
    p.skyToFree,
    p.usdsToWipe,
    p.wipeAll,
    p.usdsToBorrow,
    opt(p.selectedRewardContract),
    opt(p.selectedDelegate),
    opt(p.urnSelectedRewardContract),
    opt(p.urnSelectedVoteDelegate),
    p.rewardContractsToClaim ? `[${p.rewardContractsToClaim.join(',')}]` : '·',
    p.restakeSkyRewards,
    p.restakeSkyAmount,
    p.referralCode
  ].join('|');
}

/** The frozen legacy-widget output for a scenario. Throws on a missing key. */
function goldenOutput(params: GenerateStakeCalldataParams): `0x${string}`[] {
  const key = goldenKey(params);
  const hit = goldenFixtures[key];
  if (!hit) throw new Error(`No golden fixture for scenario: ${key}`);
  return hit;
}

describe('generateStakeCalldata — OPEN flow golden parity vs legacy fixtures', () => {
  it('open + lock only', () => {
    const params = scenario({ flow: 'open', skyToLock: 1_000_000n });
    expect(generateStakeCalldata(params)).toEqual(goldenOutput(params));
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
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
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
    expect(generateStakeCalldata(params)).toEqual(goldenOutput(params));
  });

  it('open with the default-0 referralCode matches legacy', () => {
    const params = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      selectedRewardContract: FARM,
      referralCode: 0
    });
    expect(generateStakeCalldata(params)).toEqual(goldenOutput(params));
  });

  it('emits the open calldata first when urnAddress is undefined (new position)', () => {
    const params = scenario({ flow: 'open', skyToLock: 1_000_000n });
    const pure = generateStakeCalldata(params);
    const golden = goldenOutput(params);
    // The legacy provider had no activeUrn in OPEN, so both begin with `open`.
    expect(pure[0]).toBe(golden[0]);
    expect(pure).toEqual(golden);
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

describe('generateStakeCalldata — MANAGE flow ordering golden parity vs legacy fixtures', () => {
  // Every MANAGE scenario manages an existing urn (activeUrn set).
  const manage = (overrides: Partial<GenerateStakeCalldataParams>) =>
    scenario({ flow: 'manage', urnAddress: URN, ...overrides });

  it('repay (wipe) only', () => {
    const params = manage({ usdsToWipe: 100_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
    expect(pure).toEqual([getStakeWipeCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 100_000n })]);
  });

  it('wipeAll only (calldata emitted regardless of usdsToWipe)', () => {
    const params = manage({ wipeAll: true, usdsToWipe: 0n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
    expect(pure).toEqual([getStakeWipeAllCalldata({ ownerAddress: OWNER, urnIndex: 0n })]);
  });

  it('free only', () => {
    const params = manage({ skyToFree: 500_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
    expect(pure).toEqual([
      getStakeFreeCalldata({ ownerAddress: OWNER, urnIndex: 0n, toAddress: OWNER, amount: 500_000n })
    ]);
  });

  it('repay + free — repay is ordered before free (position-safety rule)', () => {
    const params = manage({ usdsToWipe: 100_000n, skyToFree: 500_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
    expect(pure).toEqual([
      getStakeWipeCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 100_000n }),
      getStakeFreeCalldata({ ownerAddress: OWNER, urnIndex: 0n, toAddress: OWNER, amount: 500_000n })
    ]);
  });

  it('claim single reward', () => {
    const params = manage({ rewardContractsToClaim: [REWARD_A] });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
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
    expect(pure).toEqual(goldenOutput(params));
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
    expect(pure).toEqual(goldenOutput(params));
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
    expect(pure).toEqual(goldenOutput(params));
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
    expect(pure).toEqual(goldenOutput(params));
    expect(pure).toEqual([
      getStakeSelectDelegateCalldata({ ownerAddress: OWNER, urnIndex: 0n, delegateAddress: DELEGATE2 })
    ]);
  });

  it('add lock', () => {
    const params = manage({ skyToLock: 1_000_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
    expect(pure).toEqual([
      getStakeLockCalldata({ ownerAddress: OWNER, urnIndex: 0n, amount: 1_000_000n, refCode: 0 })
    ]);
  });

  it('draw more', () => {
    const params = manage({ usdsToBorrow: 500_000n });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
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
    expect(pure).toEqual(goldenOutput(params));
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
    // The capture run drove the legacy provider with StakeFlow.CLAIM for this
    // scenario and its output collided (byte-identical, per the capture-time
    // collision guard) with the MANAGE-driven fixture — CLAIM is not OPEN, so
    // it takes the manage ordering branch. The fixture locks those bytes.
    expect(generateStakeCalldata(params)).toEqual(goldenOutput(params));
  });
});

describe('generateStakeCalldata — MANAGE gating edge cases golden parity', () => {
  const manage = (overrides: Partial<GenerateStakeCalldataParams>) =>
    scenario({ flow: 'manage', urnAddress: URN, ...overrides });

  it('unchanged farm on existing urn (case-flipped) emits NO selectFarm', () => {
    const params = manage({ selectedRewardContract: FARM_UC, urnSelectedRewardContract: FARM_LC });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
    expect(pure).toEqual([]);
  });

  it('unchanged delegate on existing urn (case-flipped) emits NO selectDelegate', () => {
    const params = manage({ selectedDelegate: DELEGATE_UC, urnSelectedVoteDelegate: DELEGATE_LC });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
    expect(pure).toEqual([]);
  });

  it('undefined selection on existing urn with a set urn farm emits selectFarm with ZERO_ADDRESS', () => {
    const params = manage({ selectedRewardContract: undefined, urnSelectedRewardContract: FARM });
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(goldenOutput(params));
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
    expect(pure).toEqual(goldenOutput(params));
    // open + lock only — no select* calls
    expect(pure).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Combinatorial golden-master matrix (headline AC of F1, fixture-backed since F7).
//
// The naive full cross-product of every dimension the ticket lists —
//   flow(2) · skyToLock(2) · skyToFree(2) · usdsToBorrow(2) · usdsToWipe(2) ·
//   wipeAll(2) · farm(4) · delegate(3) · claim(4) · restake(3) · referralCode(2)
// — is 18,432 combinations. We do NOT enumerate all of them: the calldata
// assembler (`generateStakeCalldata`, extracted byte-identical from the legacy
// `context.tsx`) drops each computed element into a FIXED slot of a static
// array and then `.filter(Boolean)`s the whole thing, so the presence and
// encoding of any one element are independent of every other, with ONE
// exception: the lock slot's amount is `skyToLock + restake addend`, so
// `skyToLock` and `restake` jointly determine whether lock is emitted. That
// single cross-term is covered explicitly by Matrix D — NOT by Matrix B, which
// pins `skyToLock` non-zero. Given per-element fixed-slot independence for
// every other pair, the UNION of four orthogonal full-factorial sub-matrices
// exercises every ordering + gating interaction the full product would,
// deterministically and with no randomness:
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
//   Matrix D — skyToLock × restake × flow: the ONE non-independent cross-term.
//              Isolates the skyToLock=0 × restake:on cells — lock emitted SOLELY
//              by the restake addend (on+) or suppressed entirely (on0) — which
//              Matrix B (skyToLock pinned non-zero) never asserts vs the oracle.
//
// Cap: 64 + 576 + 48 + 12 = 700 cases (stated here per the AC). "Partial amounts +
// partial selections" combos not enumerated are structurally guaranteed by the
// per-element fixed-slot filtering above. Every case resolves its frozen legacy
// bytes from the fixtures via `goldenKey`; `it.each` names each case with its
// serialized combo so a failure points straight at the offending inputs.
//
// restake:on0 note (fixture provenance): the legacy provider's restake effect
// reset `restakeSkyRewards` to false when the mocked claim balance was 0n; the
// pure function keeps the flag but adds 0n — both agreed on lock at capture
// time, and the fixture holds those agreed bytes.
// ---------------------------------------------------------------------------

type MatrixDim = {
  tag: string;
  over: Partial<GenerateStakeCalldataParams>;
};

type MatrixCase = {
  label: string;
  params: GenerateStakeCalldataParams;
};

/**
 * Deterministic cartesian product of named dimensions. Merges each dimension's
 * `over` (later dims win) onto `base` and concatenates the `tag`s into a
 * debuggable label. No randomness — pure enumeration in declaration order.
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
    return {
      label: combo.map(d => d.tag).join(' '),
      params: scenario(over)
    };
  });
}

const flowDim: MatrixDim[] = [
  { tag: 'open', over: { flow: 'open', urnAddress: undefined } },
  { tag: 'manage', over: { flow: 'manage', urnAddress: URN } }
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

// Matrix D — skyToLock × restake × flow (12): the sole non-independent cross-term.
// The lock slot's amount is `skyToLock + (restake addend)`, so lock emission is a
// JOINT function of these two dimensions. Matrix B holds skyToLock non-zero, so the
// skyToLock=0 × restake:on cells — where lock is emitted purely by the restake
// addend (on+, total>0) or suppressed altogether (on0, total=0) — are asserted
// against the frozen oracle only here. All other amounts stay at their defaults so
// the lock slot is the only thing in play.
const matrixD = product([flowDim, skyToLockDim, restakeDim]);

describe('generateStakeCalldata — Matrix A: amounts × flow (full factorial)', () => {
  it.each(matrixA)('$label', ({ params }) => {
    expect(generateStakeCalldata(params)).toEqual(goldenOutput(params));
  });
});

describe('generateStakeCalldata — Matrix B: selections/claims/restake/referralCode × flow', () => {
  it.each(matrixB)('$label', ({ params }) => {
    expect(generateStakeCalldata(params)).toEqual(goldenOutput(params));
  });
});

describe('generateStakeCalldata — Matrix C: wipeAll × usdsToWipe × selections × flow', () => {
  it.each(matrixC)('$label', ({ params }) => {
    expect(generateStakeCalldata(params)).toEqual(goldenOutput(params));
  });
});

describe('generateStakeCalldata — Matrix D: skyToLock × restake × flow (lock cross-term)', () => {
  it.each(matrixD)('$label', ({ params }) => {
    expect(generateStakeCalldata(params)).toEqual(goldenOutput(params));
  });
});

describe('generateStakeCalldata — matrix cardinality guard', () => {
  it('enumerates the stated 700-case cap (64 + 576 + 48 + 12) deterministically', () => {
    expect(matrixA).toHaveLength(64);
    expect(matrixB).toHaveLength(576);
    expect(matrixC).toHaveLength(48);
    expect(matrixD).toHaveLength(12);
    // Labels are unique per matrix — the serialized combo is a stable case id.
    expect(new Set(matrixA.map(c => c.label)).size).toBe(matrixA.length);
    expect(new Set(matrixB.map(c => c.label)).size).toBe(matrixB.length);
    expect(new Set(matrixC.map(c => c.label)).size).toBe(matrixC.length);
    expect(new Set(matrixD.map(c => c.label)).size).toBe(matrixD.length);
  });

  it('keeps the frozen fixture set intact (709 distinct scenarios captured)', () => {
    // Captured from the legacy StakeModuleWidgetProvider oracle in the F7 flip
    // commit, with all 724 legacy-vs-pure assertions green. Distinct-scenario
    // count < case count because a handful of cases share identical params
    // (e.g. the CLAIM-flow ≡ MANAGE equivalence pair) and matrix defaults
    // overlap some handwritten scenarios.
    expect(Object.keys(goldenFixtures).length).toBe(709);
    for (const output of Object.values(goldenFixtures)) {
      expect(Array.isArray(output)).toBe(true);
      for (const hex of output) {
        expect(hex).toMatch(/^0x[0-9a-f]+$/i);
      }
    }
  });
});
