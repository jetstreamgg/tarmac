import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { type Token, TOKENS, useTokenAllowance } from '@/hooks';

interface UseApproveStepsParams {
  /** The token the action pulls from the wallet. */
  token: Token;
  /** The contract that pulls it. */
  spender: `0x${string}`;
  amount: bigint;
  /** False on the flow's other direction (a withdraw pulls nothing) — no approve step. */
  enabled: boolean;
  /** The action step the approvals precede (e.g. `Supply USDC`). */
  action: string;
  /**
   * USDT must be reset to 0 before a new approval when a non-zero allowance
   * exists — prepend the reset step where the engine sends that leg.
   */
  withUsdtReset?: boolean;
}

/**
 * The approve-step labelling every supply seam repeats. The allowance read here
 * is READ ONLY — the approve/action calls and their allowance derivation live
 * entirely inside the batch engines (TanStack dedupes this read with the
 * engine's own); it only decides whether the modal lists an Approve step ahead
 * of the action so the indicator advances in lockstep with the call count.
 * Unresolved allowance → no approve step (the engine's own read gates the
 * calls, not this label).
 */
export function useApproveSteps({
  token,
  spender,
  amount,
  enabled,
  action,
  withUsdtReset = false
}: UseApproveStepsParams): string[] {
  const { address } = useConnection();
  const chainId = useChainId();
  const symbol = token.symbol;

  const { data: allowance } = useTokenAllowance({
    chainId,
    contractAddress: token.address[chainId],
    owner: address,
    spender
  });
  const needsAllowance = enabled && allowance !== undefined && allowance < amount;
  const needsReset =
    withUsdtReset && needsAllowance && token.symbol === TOKENS.usdt.symbol && (allowance ?? 0n) > 0n;

  return useMemo<string[]>(() => {
    if (needsReset) return [t`Reset allowance`, t`Approve ${symbol}`, action];
    if (needsAllowance) return [t`Approve ${symbol}`, action];
    return [action];
  }, [needsReset, needsAllowance, symbol, action]);
}
