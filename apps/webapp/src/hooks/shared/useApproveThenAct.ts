import { useConnection } from 'wagmi';
import { Abi, Call, erc20Abi } from 'viem';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { getWriteContractCall } from './getWriteContractCall';
import { useTransactionFlow } from './useTransactionFlow';

/**
 * The ERC-20 approve a leg needs before its calls can pull the token. The
 * allowance itself is read by the product hook (each module has its own
 * allowance hook, and the launch tests mock those by path); this only decides
 * what to do with it.
 */
export type ApproveThenActApprove = {
  /** The token pulled. `undefined` (no address on this chain) skips the approve. */
  token: `0x${string}` | undefined;
  /** The contract that pulls it. `undefined` skips the approve. */
  spender: `0x${string}` | undefined;
  /** What the allowance has to cover. */
  amount: bigint;
  /** The current allowance; `undefined` while unresolved (the flow stays disabled). */
  allowance: bigint | undefined;
  allowanceError?: Error | null;
  /**
   * USDT-style tokens refuse a nonzero → nonzero approve: send `approve(0)`
   * first when an allowance already exists.
   */
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
  /**
   * The legs, in send order. Their COUNT must be stable across renders of one
   * product hook (it is a description, not a hook array, so this is only about
   * keeping `plan` indices meaningful for the caller).
   */
  legs: ApproveThenActLeg[];
  chainId: number;
};

/**
 * The one approve-then-act engine every batch hook is a thin binding of.
 *
 * Each leg's approve is elided when its allowance already covers the amount
 * (and prefixed with a reset for USDT-style tokens); the surviving calls go to
 * `useTransactionFlow`, which bundles them under EIP-5792 when `shouldUseBatch`
 * and the wallet allow it and sends them one by one otherwise. The flow is
 * disabled until every allowance has resolved and the wallet is connected, and
 * an allowance read error surfaces behind the flow's own.
 *
 * `plan` mirrors `calls` entry for entry, so the launch hooks derive their
 * step labels from the engine instead of re-reading the allowances and hoping
 * to reach the same answer (the provider advances the step indicator by
 * counting sends, so a mismatch shows the wrong step).
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
    if (approve && approve.token && approve.spender) {
      const { token, spender, amount, allowance, resetFirst, abi } = approve;
      if (allowance === undefined) allowancesResolved = false;
      allowanceError ??= approve.allowanceError ?? null;

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
    plan
  };
}
