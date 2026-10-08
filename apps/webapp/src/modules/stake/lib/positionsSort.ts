import type { Vault } from '@/hooks';
import { isLiquidatedStakePosition, type StakeUserPosition } from '../hooks/useStakeUserPositions';
import { loanToValue } from './loanToValue';

export type StakePositionsSortColumn = 'position' | 'staked' | 'borrowed' | 'ltv' | 'risk';
export type StakePositionsSort = { column: StakePositionsSortColumn; direction: 'asc' | 'desc' };

export const DEFAULT_STAKE_POSITIONS_SORT: StakePositionsSort = { column: 'position', direction: 'asc' };

/** Re-clicking a column flips it; a new column starts at its natural direction (amounts and risk largest first). */
export function nextStakePositionsSort(
  previous: StakePositionsSort,
  column: StakePositionsSortColumn
): StakePositionsSort {
  if (previous.column === column) {
    return { column, direction: previous.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { column, direction: column === 'position' ? 'asc' : 'desc' };
}

// Debt-free and liquidated rows show a dash or badge in LTV/risk, so they have no value there.
function sortValue(
  position: StakeUserPosition,
  column: StakePositionsSortColumn,
  vault: Vault | undefined
): bigint | number | undefined {
  switch (column) {
    case 'position':
      return position.index;
    case 'staked':
      return position.skyLocked;
    case 'borrowed':
      return position.usdsDebt;
    case 'ltv':
      return position.usdsDebt > 0n ? loanToValue(vault?.debtValue, vault?.collateralValue) : undefined;
    case 'risk':
      return position.usdsDebt > 0n && !isLiquidatedStakePosition(position)
        ? vault?.liquidationProximityPercentage
        : undefined;
  }
}

/** Rows without a value sort last in either direction; ties keep position order. */
export function sortStakePositions(
  positions: StakeUserPosition[],
  sort: StakePositionsSort,
  vaultOf: (index: number) => Vault | undefined
): StakeUserPosition[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...positions].sort((a, b) => {
    const aValue = sortValue(a, sort.column, vaultOf(a.index));
    const bValue = sortValue(b, sort.column, vaultOf(b.index));
    if (aValue !== bValue) {
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;
      if (aValue < bValue) return -sign;
      if (aValue > bValue) return sign;
    }
    return a.index - b.index;
  });
}
