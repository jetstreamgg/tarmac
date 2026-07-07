import { describe, expect, it } from 'vitest';
import { isInactiveStakePosition, parseStakeUserPositions } from './useStakeUserPositions';

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
      { index: 0, skyLocked: 700550000000000000000000n, usdsDebt: 30000000000000000000000n },
      { index: 1, skyLocked: 50000000000000000000000n, usdsDebt: 0n },
      { index: 2, skyLocked: 0n, usdsDebt: 0n }
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
    expect(positions).toEqual([{ index: 3, skyLocked: 1n, usdsDebt: 2n }]);
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
