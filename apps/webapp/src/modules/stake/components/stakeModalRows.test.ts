import { describe, expect, it } from 'vitest';
import { RiskLevel } from '@/hooks';
import { buildStakeConfirmRows, type StakeConfirmRowInput } from './stakeModalRows';

const BASE: StakeConfirmRowInput = {
  hasPosition: true,
  stakedBefore: '1,000.00 SKY',
  stakedAfter: '1,500.00 SKY',
  estRewardsBefore: '56.90 SKY',
  estRewardsAfter: '85.35 SKY',
  rewardRate: '5.69%',
  network: 'Ethereum',
  networkFee: '$1.23'
};

const BORROW: NonNullable<StakeConfirmRowInput['borrow']> = {
  borrowedBefore: '100.00 USDS',
  borrowedAfter: '250.00 USDS',
  borrowRate: '8.50%',
  riskBefore: RiskLevel.LOW,
  riskAfter: RiskLevel.MEDIUM,
  riskLabelBefore: 'Low',
  riskLabelAfter: 'Medium',
  liquidationBefore: '$0.0210',
  liquidationAfter: '$0.0340'
};

const SELECTIONS: NonNullable<StakeConfirmRowInput['selections']> = {
  rewardBefore: { symbol: 'SKY', label: 'SKY' },
  rewardAfter: { symbol: 'USDS', label: 'USDS' },
  rewardChanged: true,
  delegateBefore: { label: '0x0F23...cc86', address: '0x0F2300000000000000000000000000000000cc86' },
  delegateAfter: { label: 'Some Delegate', address: '0x173a000000000000000000000000000000009558' },
  delegateChanged: true
};

/** Flattens the rows to a label → cell map for the assertions below. */
const cellsByLabel = (input: StakeConfirmRowInput) =>
  Object.fromEntries(
    buildStakeConfirmRows(input)
      .flat()
      .map(cell => [cell.label, cell])
  );

describe('buildStakeConfirmRows', () => {
  it('lays the cells out two to a row, with the fee last', () => {
    const rows = buildStakeConfirmRows(BASE);

    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Staked', 'Est. 1Y rewards'],
      ['Reward rate', 'Network'],
      ['Network fee']
    ]);
  });

  it('collapses the whole borrow group on a position with no debt', () => {
    // Four cells, so the pairing of everything after them stays aligned —
    // that even-group rule is what keeps `Reward rate | Network` together.
    const labels = Object.keys(cellsByLabel(BASE));

    expect(labels).not.toContain('Borrowed');
    expect(labels).not.toContain('Borrow rate');
    expect(labels).not.toContain('Risk level');
    expect(labels).not.toContain('Liquidation price');
  });

  it('pairs the borrow cells into their own rows when debt is in play', () => {
    const rows = buildStakeConfirmRows({ ...BASE, borrow: BORROW });

    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Staked', 'Est. 1Y rewards'],
      ['Borrowed', 'Borrow rate'],
      ['Risk level', 'Liquidation price'],
      ['Reward rate', 'Network'],
      ['Network fee']
    ]);
  });

  it('draws a before→after delta only where the value actually moves', () => {
    // An unchanged leg riding along in a mixed bundle is a fact, not a no-op
    // arrow: the withdraw+delegate case would otherwise draw "Low → Low".
    const cells = cellsByLabel({
      ...BASE,
      stakedAfter: BASE.stakedBefore,
      borrow: { ...BORROW, riskLabelAfter: BORROW.riskLabelBefore }
    });

    expect(cells['Staked'].kind).toBe('single');
    expect(cells['Risk level'].kind).toBe('single');
    expect(cells['Borrowed'].kind).toBe('delta');
  });

  it('states the resulting value, not the empty one, when there is no position', () => {
    // The open flow has no "before" — a `single` cell reading "0.00 SKY" would
    // describe the position the user is leaving, not the one being created.
    const cells = cellsByLabel({ ...BASE, hasPosition: false, borrow: BORROW });

    expect(cells['Staked']).toMatchObject({ kind: 'single', value: '1,500.00 SKY' });
    expect(cells['Borrowed']).toMatchObject({ kind: 'single', value: '250.00 USDS' });
    expect(cells['Risk level']).toMatchObject({ kind: 'single', value: 'Medium' });
  });

  it('carries a different token icon on each side of a reward-farm switch', () => {
    const cells = cellsByLabel({ ...BASE, selections: SELECTIONS });

    expect(cells['Reward']).toMatchObject({
      kind: 'delta',
      before: 'SKY',
      after: 'USDS',
      token: 'SKY',
      afterToken: 'USDS'
    });
  });

  it('carries an identicon seed on each side of a delegate switch', () => {
    const cells = cellsByLabel({ ...BASE, selections: SELECTIONS });

    expect(cells['Delegate']).toMatchObject({
      kind: 'delta',
      after: 'Some Delegate',
      avatar: SELECTIONS.delegateBefore.address,
      afterAvatar: SELECTIONS.delegateAfter.address
    });
  });

  it('keeps the untouched selection as a single current value', () => {
    // Reward and delegate are emitted as a PAIR so the row stays even; the leg
    // that is not changing states what it is, which the review needs anyway.
    const cells = cellsByLabel({
      ...BASE,
      selections: { ...SELECTIONS, delegateAfter: SELECTIONS.delegateBefore, delegateChanged: false }
    });

    expect(cells['Reward'].kind).toBe('delta');
    expect(cells['Delegate']).toMatchObject({ kind: 'single', value: '0x0F23...cc86' });
  });

  it('tints the risk cell per side', () => {
    const cells = cellsByLabel({ ...BASE, borrow: BORROW });

    expect(cells['Risk level']).toMatchObject({ tone: 'success', afterTone: 'warning' });
  });

  it('spells the fee label the live estimate is keyed on', () => {
    // `toGridCells` swaps this exact cell for the live estimate + bundling
    // panel — a drifted label would silently unhook it.
    expect(cellsByLabel(BASE)['Network fee']).toMatchObject({ kind: 'single', value: '$1.23' });
  });
});
