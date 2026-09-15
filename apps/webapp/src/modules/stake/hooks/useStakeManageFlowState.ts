import { useReducer } from 'react';

export type StakeCardMode = 'stake' | 'withdraw';
export type BorrowCardMode = 'borrow' | 'repay';

/**
 * Manage-sheet form state (UX B.3): two independently-toggleable cards, each
 * with a segmented mode (Stake|Withdraw, Borrow|Repay). `skyAmount` /
 * `usdsAmount` are interpreted through the card's mode (lock vs free, borrow vs
 * wipe). Reward and delegate changes live in their own modals
 * (`StakeChangeSelectionModal`), not in the sheet.
 */
export interface StakeManageFlowState {
  stakeEnabled: boolean;
  stakeMode: StakeCardMode;
  skyAmount: bigint;
  borrowEnabled: boolean;
  borrowMode: BorrowCardMode;
  usdsAmount: bigint;
  /** Legacy Repay semantics (M11): only the exact-max staging may set this. */
  wipeAll: boolean;
}

export type StakeManageFlowAction =
  | { type: 'setStakeEnabled'; enabled: boolean }
  | { type: 'setStakeMode'; mode: StakeCardMode }
  | { type: 'setSkyAmount'; amount: bigint }
  | { type: 'setBorrowEnabled'; enabled: boolean }
  | { type: 'setBorrowMode'; mode: BorrowCardMode }
  | { type: 'setUsdsAmount'; amount: bigint; wipeAll?: boolean };

/** Deep-link pre-toggle mapping from the details-modal menu (UX B.3). */
export interface StakeManageFlowInit {
  stakeCard?: StakeCardMode;
  borrowCard?: BorrowCardMode;
}

export function initStakeManageFlowState({
  stakeCard,
  borrowCard
}: StakeManageFlowInit): StakeManageFlowState {
  return {
    stakeEnabled: stakeCard !== undefined,
    stakeMode: stakeCard ?? 'stake',
    skyAmount: 0n,
    borrowEnabled: borrowCard !== undefined,
    borrowMode: borrowCard ?? 'borrow',
    usdsAmount: 0n,
    wipeAll: false
  };
}

export function stakeManageFlowReducer(
  state: StakeManageFlowState,
  action: StakeManageFlowAction
): StakeManageFlowState {
  switch (action.type) {
    case 'setStakeEnabled':
      return { ...state, stakeEnabled: action.enabled, skyAmount: action.enabled ? state.skyAmount : 0n };
    case 'setStakeMode':
      // Mode swap clears only this card's amount (M21) — the legacy widget
      // cleared everything because its tabs swapped both cards at once.
      return state.stakeMode === action.mode ? state : { ...state, stakeMode: action.mode, skyAmount: 0n };
    case 'setSkyAmount':
      return { ...state, skyAmount: action.amount };
    case 'setBorrowEnabled':
      return {
        ...state,
        borrowEnabled: action.enabled,
        usdsAmount: action.enabled ? state.usdsAmount : 0n,
        wipeAll: action.enabled ? state.wipeAll : false
      };
    case 'setBorrowMode':
      return state.borrowMode === action.mode
        ? state
        : { ...state, borrowMode: action.mode, usdsAmount: 0n, wipeAll: false };
    case 'setUsdsAmount':
      // Typing always resets wipeAll (legacy Repay onChange); the 100%-chip
      // staging passes wipeAll explicitly when it equals the full debt.
      return { ...state, usdsAmount: action.amount, wipeAll: action.wipeAll ?? false };
    default:
      return state;
  }
}

/** Reducer-backed hook the manage sheet consumes. */
export function useStakeManageFlowState(init: StakeManageFlowInit) {
  return useReducer(stakeManageFlowReducer, init, initStakeManageFlowState);
}
