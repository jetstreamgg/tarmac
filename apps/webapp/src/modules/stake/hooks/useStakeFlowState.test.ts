import { describe, expect, it } from 'vitest';
import { initialStakeFlowState, stakeFlowReducer, StakeFlowState } from './useStakeFlowState';

const DELEGATE = '0x1111111111111111111111111111111111111111' as const;
const OTHER_DELEGATE = '0x2222222222222222222222222222222222222222' as const;
const REWARD = '0x3333333333333333333333333333333333333333' as const;

describe('stakeFlowReducer', () => {
  it('starts with everything empty and both optional cards off (A-Q1)', () => {
    expect(initialStakeFlowState).toEqual({
      skyToLock: 0n,
      borrowEnabled: false,
      usdsToBorrow: 0n,
      delegateEnabled: false,
      selectedDelegate: undefined,
      selectedRewardContract: undefined
    });
  });

  it('sets amounts', () => {
    let state = stakeFlowReducer(initialStakeFlowState, { type: 'setSkyToLock', amount: 100n });
    state = stakeFlowReducer(state, { type: 'setBorrowEnabled', enabled: true });
    state = stakeFlowReducer(state, { type: 'setUsdsToBorrow', amount: 42n });

    expect(state.skyToLock).toBe(100n);
    expect(state.borrowEnabled).toBe(true);
    expect(state.usdsToBorrow).toBe(42n);
  });

  it('disabling borrow clears the borrow amount', () => {
    let state: StakeFlowState = {
      ...initialStakeFlowState,
      borrowEnabled: true,
      usdsToBorrow: 42n
    };
    state = stakeFlowReducer(state, { type: 'setBorrowEnabled', enabled: false });

    expect(state.borrowEnabled).toBe(false);
    expect(state.usdsToBorrow).toBe(0n);
  });

  it('disabling delegation clears the selected delegate', () => {
    let state: StakeFlowState = {
      ...initialStakeFlowState,
      delegateEnabled: true,
      selectedDelegate: DELEGATE
    };
    state = stakeFlowReducer(state, { type: 'setDelegateEnabled', enabled: false });

    expect(state.delegateEnabled).toBe(false);
    expect(state.selectedDelegate).toBeUndefined();
  });

  it('selecting a delegate is single-select with click-again-to-deselect (legacy parity)', () => {
    let state = stakeFlowReducer(
      { ...initialStakeFlowState, delegateEnabled: true },
      { type: 'selectDelegate', delegate: DELEGATE }
    );
    expect(state.selectedDelegate).toBe(DELEGATE);

    state = stakeFlowReducer(state, { type: 'selectDelegate', delegate: OTHER_DELEGATE });
    expect(state.selectedDelegate).toBe(OTHER_DELEGATE);

    state = stakeFlowReducer(state, { type: 'selectDelegate', delegate: OTHER_DELEGATE });
    expect(state.selectedDelegate).toBeUndefined();
  });

  it('stores the selected reward contract (auto-defaulted by the takeover, A-Q2)', () => {
    const state = stakeFlowReducer(initialStakeFlowState, {
      type: 'selectRewardContract',
      rewardContract: REWARD
    });
    expect(state.selectedRewardContract).toBe(REWARD);
  });
});
