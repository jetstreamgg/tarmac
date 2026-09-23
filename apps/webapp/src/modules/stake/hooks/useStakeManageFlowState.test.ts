import { describe, expect, it } from 'vitest';
import {
  initStakeManageFlowState,
  stakeManageFlowReducer,
  StakeManageFlowState
} from './useStakeManageFlowState';

const base: StakeManageFlowState = initStakeManageFlowState({});

describe('initStakeManageFlowState', () => {
  it('starts with the borrow card off by default', () => {
    expect(base).toEqual({
      stakeMode: 'stake',
      skyAmount: 0n,
      borrowEnabled: false,
      borrowMode: 'borrow',
      usdsAmount: 0n,
      wipeAll: false
    });
  });

  it('pre-toggles cards per the menu deep-link mapping', () => {
    expect(initStakeManageFlowState({ stakeCard: 'withdraw' })).toMatchObject({ stakeMode: 'withdraw' });
    expect(initStakeManageFlowState({ borrowCard: 'repay' })).toMatchObject({
      borrowEnabled: true,
      borrowMode: 'repay'
    });
  });
});

describe('stakeManageFlowReducer', () => {
  it('clears the borrow amount when its toggle goes off', () => {
    const withRepay = stakeManageFlowReducer(
      { ...base, borrowEnabled: true, borrowMode: 'repay', usdsAmount: 5n, wipeAll: true },
      { type: 'setBorrowEnabled', enabled: false }
    );
    expect(withRepay.usdsAmount).toBe(0n);
    expect(withRepay.wipeAll).toBe(false);
  });

  it('clears only that card amount on a segmented mode switch (M21)', () => {
    const state: StakeManageFlowState = {
      ...base,
      skyAmount: 7n,
      borrowEnabled: true,
      borrowMode: 'repay',
      usdsAmount: 9n,
      wipeAll: true
    };
    const switched = stakeManageFlowReducer(state, { type: 'setStakeMode', mode: 'withdraw' });
    expect(switched.skyAmount).toBe(0n);
    expect(switched.usdsAmount).toBe(9n); // other card untouched

    const borrowSwitched = stakeManageFlowReducer(state, { type: 'setBorrowMode', mode: 'borrow' });
    expect(borrowSwitched.usdsAmount).toBe(0n);
    expect(borrowSwitched.wipeAll).toBe(false);
    expect(borrowSwitched.skyAmount).toBe(7n);
  });

  it('typing a USDS amount clears wipeAll; staging max can set it (M11)', () => {
    const staged = stakeManageFlowReducer(
      { ...base, borrowEnabled: true, borrowMode: 'repay' },
      { type: 'setUsdsAmount', amount: 100n, wipeAll: true }
    );
    expect(staged.wipeAll).toBe(true);

    const typed = stakeManageFlowReducer(staged, { type: 'setUsdsAmount', amount: 50n });
    expect(typed.wipeAll).toBe(false);
  });
});
