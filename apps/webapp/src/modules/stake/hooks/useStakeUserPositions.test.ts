import { describe, expect, it } from 'vitest';
import {
  isInactiveStakePosition,
  isLiquidatedStakePosition,
  lastStakeUrnBark,
  parseStakeUserPositions
} from './useStakeUserPositions';
import type { StakeUrnBark, StakeUserPosition } from './useStakeUserPositions';

describe('parseStakeUserPositions', () => {
  it('maps subgraph urns to bigint positions sorted by index', () => {
    const positions = parseStakeUserPositions({
      stakingUrns: [
        { index: 2, skyLocked: '0', usdsDebt: '0' },
        { index: 0, skyLocked: '700550000000000000000000', usdsDebt: '30000000000000000000000' },
        { index: 1, skyLocked: '50000000000000000000000', usdsDebt: '0' }
      ]
    });

    expect(positions).toEqual([
      { index: 0, skyLocked: 700550000000000000000000n, usdsDebt: 30000000000000000000000n, barks: [] },
      { index: 1, skyLocked: 50000000000000000000000n, usdsDebt: 0n, barks: [] },
      { index: 2, skyLocked: 0n, usdsDebt: 0n, barks: [] }
    ]);
  });

  it('returns an empty array when the response has no urns', () => {
    expect(parseStakeUserPositions({ stakingUrns: [] })).toEqual([]);
    expect(parseStakeUserPositions({ stakingUrns: undefined as never })).toEqual([]);
  });

  it('tolerates string indexes from the subgraph', () => {
    const positions = parseStakeUserPositions({
      stakingUrns: [{ index: '3' as unknown as number, skyLocked: '1', usdsDebt: '2' }]
    });
    expect(positions).toEqual([{ index: 3, skyLocked: 1n, usdsDebt: 2n, barks: [] }]);
  });
});

describe('isInactiveStakePosition', () => {
  it('is inactive only when both staked and borrowed are zero', () => {
    expect(isInactiveStakePosition({ skyLocked: 0n, usdsDebt: 0n })).toBe(true);
    expect(isInactiveStakePosition({ skyLocked: 1n, usdsDebt: 0n })).toBe(false);
    expect(isInactiveStakePosition({ skyLocked: 0n, usdsDebt: 1n })).toBe(false);
    expect(isInactiveStakePosition({ skyLocked: 1n, usdsDebt: 1n })).toBe(false);
  });
});

describe('parseStakeUserPositions — barks', () => {
  it('defaults barks to an empty array when the urn has none', () => {
    const positions = parseStakeUserPositions({
      stakingUrns: [{ index: 0, skyLocked: '0', usdsDebt: '0' }]
    });

    expect(positions).toEqual([{ index: 0, skyLocked: 0n, usdsDebt: 0n, barks: [] }]);
  });

  it('defaults barks to an empty array when the field is explicitly null', () => {
    const positions = parseStakeUserPositions({
      stakingUrns: [{ index: 0, skyLocked: '0', usdsDebt: '0', barks: null as never }]
    });

    expect(positions).toEqual([{ index: 0, skyLocked: 0n, usdsDebt: 0n, barks: [] }]);
  });

  it('parses a single bark, converting numeric strings to bigint/number', () => {
    const positions = parseStakeUserPositions({
      stakingUrns: [
        {
          index: 0,
          skyLocked: '0',
          usdsDebt: '0',
          barks: [
            {
              id: '1-0x4c534556322d534b592d41-3',
              ilk: '0x4c534556322d534b592d41',
              clip: '0x71eb8943c6b4426b315745c6001ae824e6dc7fb2',
              clipperId: '3',
              ink: '15000000000000000000000000',
              art: '30000000000000000000000',
              due: '33900000000000000000000000000000000000000000',
              blockTimestamp: '1782482411',
              transactionHash: '0xf90d3823abc'
            }
          ]
        }
      ]
    });

    expect(positions).toEqual([
      {
        index: 0,
        skyLocked: 0n,
        usdsDebt: 0n,
        barks: [
          {
            id: '1-0x4c534556322d534b592d41-3',
            ilk: '0x4c534556322d534b592d41',
            clip: '0x71eb8943c6b4426b315745c6001ae824e6dc7fb2',
            clipperId: '3',
            ink: 15000000000000000000000000n,
            art: 30000000000000000000000n,
            due: 33900000000000000000000000000000000000000000n,
            blockTimestamp: 1782482411,
            transactionHash: '0xf90d3823abc'
          }
        ],
        lastMutationTimestamp: undefined
      }
    ]);
  });
});

describe('parseStakeUserPositions — lastMutationTimestamp', () => {
  it('is undefined when the urn has no mutating events', () => {
    const [position] = parseStakeUserPositions({
      stakingUrns: [{ index: 0, skyLocked: '0', usdsDebt: '0' }]
    });
    expect(position.lastMutationTimestamp).toBeUndefined();
  });

  it('is undefined when every event array is explicitly null', () => {
    const [position] = parseStakeUserPositions({
      stakingUrns: [
        {
          index: 0,
          skyLocked: '0',
          usdsDebt: '0',
          locks: null as never,
          frees: null as never,
          draws: null as never,
          wipes: null as never
        }
      ]
    });
    expect(position.lastMutationTimestamp).toBeUndefined();
  });

  it('takes the latest timestamp across locks/frees/draws/wipes', () => {
    const [position] = parseStakeUserPositions({
      stakingUrns: [
        {
          index: 0,
          skyLocked: '0',
          usdsDebt: '0',
          locks: [{ blockTimestamp: '100' }],
          frees: [{ blockTimestamp: '300' }],
          draws: [{ blockTimestamp: '200' }],
          wipes: [{ blockTimestamp: '50' }]
        }
      ]
    });
    expect(position.lastMutationTimestamp).toBe(300);
  });

  it('ignores null arrays alongside populated ones', () => {
    const [position] = parseStakeUserPositions({
      stakingUrns: [
        {
          index: 0,
          skyLocked: '0',
          usdsDebt: '0',
          locks: null as never,
          frees: [{ blockTimestamp: '10' }]
        }
      ]
    });
    expect(position.lastMutationTimestamp).toBe(10);
  });
});

function makeBark(overrides: Partial<StakeUrnBark> = {}): StakeUrnBark {
  return {
    id: '1-ilk-1',
    ilk: '0x4c534556322d534b592d41',
    clip: '0x71eb8943c6b4426b315745c6001ae824e6dc7fb2',
    clipperId: '1',
    ink: 15000000000000000000000000n,
    art: 30000000000000000000000n,
    due: 33900000000000000000000000000000000000000000n,
    blockTimestamp: 1_700_000_000,
    transactionHash: '0xf90d3823abc',
    ...overrides
  };
}

function makePosition(overrides: Partial<StakeUserPosition> = {}): StakeUserPosition {
  return {
    index: 0,
    skyLocked: 0n,
    usdsDebt: 0n,
    barks: [],
    lastMutationTimestamp: undefined,
    ...overrides
  };
}

describe('lastStakeUrnBark', () => {
  it('returns undefined when there are no barks', () => {
    expect(lastStakeUrnBark(makePosition({ barks: [] }))).toBeUndefined();
  });

  it('picks the bark with the greatest blockTimestamp', () => {
    const older = makeBark({ id: 'older', blockTimestamp: 1_600_000_000 });
    const newer = makeBark({ id: 'newer', blockTimestamp: 1_700_000_000 });
    expect(lastStakeUrnBark(makePosition({ barks: [older, newer] }))).toEqual(newer);
  });
});

describe('isLiquidatedStakePosition', () => {
  it('is false with no barks', () => {
    expect(isLiquidatedStakePosition(makePosition({ barks: [] }))).toBe(false);
  });

  it('is true with a bark and no mutating events', () => {
    const theBark = makeBark({ blockTimestamp: 1_700_000_000 });
    expect(
      isLiquidatedStakePosition(makePosition({ barks: [theBark], lastMutationTimestamp: undefined }))
    ).toBe(true);
  });

  it('is true with a bark and an older mutation', () => {
    const theBark = makeBark({ blockTimestamp: 1_700_000_000 });
    expect(
      isLiquidatedStakePosition(makePosition({ barks: [theBark], lastMutationTimestamp: 1_600_000_000 }))
    ).toBe(true);
  });

  it('is false with a bark and a strictly newer mutation (a recovery free)', () => {
    const theBark = makeBark({ blockTimestamp: 1_700_000_000 });
    expect(
      isLiquidatedStakePosition(makePosition({ barks: [theBark], lastMutationTimestamp: 1_700_000_100 }))
    ).toBe(false);
  });

  it('is true when the mutation timestamp equals the bark timestamp (strictly-newer rule)', () => {
    const theBark = makeBark({ blockTimestamp: 1_700_000_000 });
    expect(
      isLiquidatedStakePosition(makePosition({ barks: [theBark], lastMutationTimestamp: 1_700_000_000 }))
    ).toBe(true);
  });

  it('uses the newest of two barks to evaluate the strictly-newer rule', () => {
    const olderBark = makeBark({ id: 'older', blockTimestamp: 1_600_000_000 });
    const newerBark = makeBark({ id: 'newer', blockTimestamp: 1_700_000_000 });
    // A mutation newer than the older bark but not the newer one: still liquidated.
    expect(
      isLiquidatedStakePosition(
        makePosition({ barks: [olderBark, newerBark], lastMutationTimestamp: 1_650_000_000 })
      )
    ).toBe(true);
  });
});
