import { useReducer } from 'react';

/**
 * Takeover-local form state (Architecture Proposal §3/§5): replaces the legacy
 * widget-context booleans (`isLockCompleted` etc. die with the step model).
 * Both optional cards start OFF (decision A-Q1 — the "01" mock showing the
 * delegate list expanded on an otherwise-empty form is a mock inconsistency).
 * `selectedRewardContract` exists so the engine's required `selectFarm` call is
 * explicit state — the takeover auto-defaults it to the SKY farm (A-Q2, pending
 * product ruling on a visible picker).
 */
export interface StakeFlowState {
  skyToLock: bigint;
  borrowEnabled: boolean;
  usdsToBorrow: bigint;
  delegateEnabled: boolean;
  selectedDelegate: `0x${string}` | undefined;
  selectedRewardContract: `0x${string}` | undefined;
}

export type StakeFlowAction =
  | { type: 'setSkyToLock'; amount: bigint }
  | { type: 'setBorrowEnabled'; enabled: boolean }
  | { type: 'setUsdsToBorrow'; amount: bigint }
  | { type: 'setDelegateEnabled'; enabled: boolean }
  | { type: 'selectDelegate'; delegate: `0x${string}` }
  | { type: 'selectRewardContract'; rewardContract: `0x${string}` | undefined };

export const initialStakeFlowState: StakeFlowState = {
  skyToLock: 0n,
  borrowEnabled: false,
  usdsToBorrow: 0n,
  delegateEnabled: false,
  selectedDelegate: undefined,
  selectedRewardContract: undefined
};

export function stakeFlowReducer(state: StakeFlowState, action: StakeFlowAction): StakeFlowState {
  switch (action.type) {
    case 'setSkyToLock':
      return { ...state, skyToLock: action.amount };
    case 'setBorrowEnabled':
      // Turning the card off zeroes the amount so calldata/simulation follow.
      return {
        ...state,
        borrowEnabled: action.enabled,
        usdsToBorrow: action.enabled ? state.usdsToBorrow : 0n
      };
    case 'setUsdsToBorrow':
      return { ...state, usdsToBorrow: action.amount };
    case 'setDelegateEnabled':
      return {
        ...state,
        delegateEnabled: action.enabled,
        selectedDelegate: action.enabled ? state.selectedDelegate : undefined
      };
    case 'selectDelegate':
      // Single-select, click-again-to-deselect — legacy DelegateCard parity.
      return {
        ...state,
        selectedDelegate: state.selectedDelegate === action.delegate ? undefined : action.delegate
      };
    case 'selectRewardContract':
      return { ...state, selectedRewardContract: action.rewardContract };
    default:
      return state;
  }
}

/** Reducer-backed hook the takeover consumes. */
export function useStakeFlowState() {
  return useReducer(stakeFlowReducer, initialStakeFlowState);
}
