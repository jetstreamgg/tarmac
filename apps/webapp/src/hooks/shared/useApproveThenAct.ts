import { useMemo } from 'react';
import { useConnection } from 'wagmi';
import { Abi, Call, erc20Abi } from 'viem';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { getWriteContractCall } from './getWriteContractCall';
import { useTransactionFlow } from './useTransactionFlow';

/**
 * The ERC-20 approve a leg needs before its calls can pull the token. The
 * caller reads the allowance (the launch tests mock those reads by path).
 */
export type ApproveThenActApprove = {
  /**
   * The token pulled. `undefined` means the contract has no address on the
   * connected chain: the flow stays disabled (never "skip the approve"), the
   * same way an unresolved allowance holds it, so an off-chain launch cannot
   * send the action alone.
   */
  token: `0x${string}` | undefined;
  /** The contract that pulls it. `undefined` disables the flow, as for `token`. */
  spender: `0x${string}` | undefined;
  /** What the allowance has to cover. */
  amount: bigint;
  /** The current allowance; `undefined` while unresolved (the flow stays disabled). */
  allowance: bigint | undefined;
  allowanceError?: Error | null;
  /** USDT-style tokens refuse a nonzero → nonzero approve: send `approve(0)` first. */
  resetFirst?: boolean;
  /** ABI whose `approve` to encode; viem's erc20Abi by default. */
  abi?: Abi;
};

/** One "approve, then act" pair. A leg with no `approve` is action-only. */
export type ApproveThenActLeg = {
  approve?: ApproveThenActApprove;
  /** The calls the approve unlocks, in order. Empty while their inputs are missing. */
  calls: Call[];
};

/** What each entry of `calls` is, in the same order — for labelling the modal's steps. */
export type CallPlanEntry = {
  kind: 'reset' | 'approve' | 'action';
  /** Index into the `legs` the hook was given. */
  leg: number;
  /** The token approved (reset/approve entries). */
  token?: `0x${string}`;
};

export type ApproveThenActHook = BatchWriteHook & {
  /** One entry per call in `calls`, so a launch hook can label steps without re-deriving allowances. */
  plan: CallPlanEntry[];
};

export type UseApproveThenActParams = BatchWriteHookParams & {
  /** The legs, in send order. */
  legs: ApproveThenActLeg[];
  chainId: number;
};

/**
 * The one approve-then-act engine. Each leg's approve is elided when its
 * allowance covers the amount (and prefixed with a reset for USDT-style
 * tokens); the surviving calls go to `useTransactionFlow`. Disabled until every
 * allowance has resolved and the wallet is connected. `plan` mirrors `calls`
 * entry for entry so launch hooks label steps off the engine (the provider
 * advances the step indicator by counting sends, so a mismatch shows the
 * wrong step).
 */
export function useApproveThenAct({
  legs,
  chainId,
  enabled: paramEnabled = true,
  shouldUseBatch = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: UseApproveThenActParams): ApproveThenActHook {
  const { address, isConnected } = useConnection();

  const calls: Call[] = [];
  const plan: CallPlanEntry[] = [];
  let allowancesResolved = true;
  let allowanceError: Error | null = null;

  legs.forEach(({ approve, calls: actions }, leg) => {
    if (approve && (!approve.token || !approve.spender)) {
      // No address on this chain. Treated like an unresolved allowance so the
      // action can't go out unapproved (the chain guard closes the modal).
      allowancesResolved = false;
    } else if (approve && approve.token && approve.spender) {
      const { token, spender, amount, allowance, resetFirst, abi } = approve;
      if (allowance === undefined) allowancesResolved = false;
      allowanceError ??= approve.allowanceError ?? null;

      // Unresolved counts as "needs approve" so the plan (and the step list
      // built from it) carries the pessimistic shape; the flow is disabled
      // until every allowance lands, and the list only renders once the user
      // can confirm, so the guess is never on screen for entry/review flows.
      const needsApprove = allowance === undefined || allowance < amount;
      if (needsApprove) {
        const approveWith = (value: bigint) =>
          abi
            ? ({ to: token, abi, functionName: 'approve', args: [spender, value] } as Call)
            : getWriteContractCall({
                to: token,
                abi: erc20Abi,
                functionName: 'approve',
                args: [spender, value]
              });
        if (resetFirst && allowance !== undefined && allowance > 0n) {
          calls.push(approveWith(0n));
          plan.push({ kind: 'reset', leg, token });
        }
        calls.push(approveWith(amount));
        plan.push({ kind: 'approve', leg, token });
      }
    }
    actions.forEach(call => {
      calls.push(call);
      plan.push({ kind: 'action', leg });
    });
  });

  const enabled = paramEnabled && isConnected && !!address && allowancesResolved && calls.length > 0;

  // Steps are memoized on the plan and pushed into the session by an effect,
  // so the plan keeps its identity while its content is unchanged.
  const planKey = plan.map(({ kind, leg, token }) => `${kind}:${leg}:${token ?? ''}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the plan's content, not its per-render array
  const stablePlan = useMemo(() => plan, [planKey]);

  const flow = useTransactionFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch,
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...flow,
    error: flow.error || allowanceError,
    plan: stablePlan
  };
}
