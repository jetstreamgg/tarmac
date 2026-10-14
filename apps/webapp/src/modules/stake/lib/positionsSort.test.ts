import { describe, expect, it } from 'vitest';
import type { Vault } from '@/hooks';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { DEFAULT_STAKE_POSITIONS_SORT, nextStakePositionsSort, sortStakePositions } from './positionsSort';

const WAD = 10n ** 18n;

const position = (
  index: number,
  skyLocked: bigint,
  usdsDebt: bigint,
  barks: StakeUserPosition['barks'] = []
) =>
  ({
    index,
    urnAddress: '0x1',
    skyLocked,
    usdsDebt,
    barks,
    lastMutationTimestamp: undefined
  }) as StakeUserPosition;

const vaults: Record<number, Partial<Vault>> = {
  0: { debtValue: 50n * WAD, collateralValue: 100n * WAD, liquidationProximityPercentage: 60 },
  1: { debtValue: 10n * WAD, collateralValue: 100n * WAD, liquidationProximityPercentage: 15 },
  3: { debtValue: 30n * WAD, collateralValue: 100n * WAD, liquidationProximityPercentage: 40 }
};
const vaultOf = (index: number) => vaults[index] as Vault | undefined;

const indices = (rows: StakeUserPosition[]) => rows.map(row => row.index);

describe('positionsSort', () => {
  const rows = [position(3, 5n, 3n), position(0, 5n, 5n), position(2, 9n, 0n), position(1, 1n, 1n)];

  it('defaults to Position ID ascending', () => {
    expect(indices(sortStakePositions(rows, DEFAULT_STAKE_POSITIONS_SORT, vaultOf))).toEqual([0, 1, 2, 3]);
  });

  it('breaks ties by position', () => {
    expect(indices(sortStakePositions(rows, { column: 'staked', direction: 'desc' }, vaultOf))).toEqual([
      2, 0, 3, 1
    ]);
  });

  it('puts debt-free rows last for LTV in either direction', () => {
    expect(indices(sortStakePositions(rows, { column: 'ltv', direction: 'desc' }, vaultOf))).toEqual([
      0, 3, 1, 2
    ]);
    expect(indices(sortStakePositions(rows, { column: 'ltv', direction: 'asc' }, vaultOf))).toEqual([
      1, 3, 0, 2
    ]);
  });

  it('puts liquidated rows with no risk value', () => {
    const liquidated = position(0, 5n, 5n, [
      {
        id: '1',
        ilk: '0x',
        clip: '0x',
        clipperId: '1',
        ink: 1n,
        art: 1n,
        due: 1n,
        blockTimestamp: 1,
        transactionHash: '0x'
      }
    ]);
    const withLiquidated = [liquidated, ...rows.slice(2), rows[0]];
    expect(
      indices(sortStakePositions(withLiquidated, { column: 'risk', direction: 'desc' }, vaultOf))
    ).toEqual([3, 1, 0, 2]);
  });

  it('starts a new column at its natural direction and flips a repeated one', () => {
    expect(nextStakePositionsSort(DEFAULT_STAKE_POSITIONS_SORT, 'position')).toEqual({
      column: 'position',
      direction: 'desc'
    });
    expect(nextStakePositionsSort(DEFAULT_STAKE_POSITIONS_SORT, 'borrowed')).toEqual({
      column: 'borrowed',
      direction: 'desc'
    });
  });
});
