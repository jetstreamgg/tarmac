import { describe, expect, it } from 'vitest';
import { Intent } from '@/lib/enums';
import { buildSuppliedLegend } from './suppliedLegend';
import type { SuppliedPosition } from './suppliedView';

/** Positions from percentage shares (of a $10,000 total), largest first. */
const positionsFrom = (...pcts: number[]): SuppliedPosition[] =>
  pcts.map((pct, i) => ({
    id: `p${i}:1`,
    rowId: `p${i}`,
    name: `Product ${i}`,
    tokenSymbol: 'USDS',
    kind: 'savings',
    intent: Intent.SAVINGS_INTENT,
    amountUsd: pct * 100,
    rateLoading: false,
    color: '#000',
    hoverColor: '#000',
    share: pct / 100,
    detailPath: '/earn/savings',
    chainId: 1,
    multichain: false
  }));

const ids = (positions: SuppliedPosition[]) => positions.map(p => p.rowId);

describe('buildSuppliedLegend', () => {
  it('shows every position, however small, up to 3 positions', () => {
    const positions = positionsFrom(99, 0.6, 0.4);
    expect(buildSuppliedLegend(positions)).toEqual({ named: positions, others: [] });
  });

  it('folds positions under 1% into Others from 4 positions', () => {
    const { named, others } = buildSuppliedLegend(positionsFrom(60, 39, 0.6, 0.4));
    expect(ids(named)).toEqual(['p0', 'p1']);
    expect(ids(others)).toEqual(['p2', 'p3']);
  });

  it('folds a lone small position too once there are 4 positions', () => {
    const { named, others } = buildSuppliedLegend(positionsFrom(60, 30, 9.5, 0.5));
    expect(ids(named)).toEqual(['p0', 'p1', 'p2']);
    expect(ids(others)).toEqual(['p3']);
  });

  it('keeps 4 positions of 1% or more as they are', () => {
    const { named, others } = buildSuppliedLegend(positionsFrom(70, 20, 9, 1));
    expect(ids(named)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(others).toEqual([]);
  });

  it('keeps exactly 5 positions of 1% or more as they are', () => {
    const { named, others } = buildSuppliedLegend(positionsFrom(80, 10, 5, 3, 2));
    expect(ids(named)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(others).toEqual([]);
  });

  it('still folds the small ones out of exactly 5 positions', () => {
    const { named, others } = buildSuppliedLegend(positionsFrom(80, 10, 5, 4.5, 0.5));
    expect(ids(named)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(ids(others)).toEqual(['p4']);
  });

  it('caps the legend at the 4 largest plus Others from 6 positions', () => {
    const { named, others } = buildSuppliedLegend(positionsFrom(80, 8, 5, 3, 2, 2));
    expect(ids(named)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(ids(others)).toEqual(['p4', 'p5']);
  });

  it('applies both rules together: small positions and the tail share one Others', () => {
    const { named, others } = buildSuppliedLegend(positionsFrom(33, 30, 8, 7, 6, 6, 4, 3, 2.5, 0.3, 0.2));
    expect(ids(named)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(others).toHaveLength(7);
  });

  it('folds small positions even when that leaves fewer than 4 named rows', () => {
    const { named, others } = buildSuppliedLegend(positionsFrom(89, 10, 0.5, 0.3, 0.2));
    expect(ids(named)).toEqual(['p0', 'p1']);
    expect(ids(others)).toEqual(['p2', 'p3', 'p4']);
  });

  it('returns no rows for no positions', () => {
    expect(buildSuppliedLegend([])).toEqual({ named: [], others: [] });
  });
});
