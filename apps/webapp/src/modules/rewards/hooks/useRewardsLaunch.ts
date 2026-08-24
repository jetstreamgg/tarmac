import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { type Token, useBatchRewardsSupply, useRewardsWithdraw, useTokenAllowance } from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';

export type RewardsLaunchFlow = 'supply' | 'withdraw';

/** The engine inputs each surface (modal body) derives and spreads in. */
export interface RewardsEngineParams {
  flow: RewardsLaunchFlow;
  contractAddress: `0x${string}`;
  /** The token staked into the reward contract (USDS for every current farm). */
  supplyToken: Token;
  amount: bigint;
}

export type UseRewardsLaunchResult = EngineLaunchResult;

/**
 * The seam between the redesigned rewards modal and the (unmodified)
 * StakingRewards engine hooks — the rewards analogue of `useVaultLaunch`.
 * Routes a flow + amount to the correct engine, spreads the TransactionContext
 * `txCallbacks` in, and derives the step labels:
 *  - supply   → `useBatchRewardsSupply` (optional approve → `stake(amount, ref)`)
 *  - withdraw → `useRewardsWithdraw` (`withdraw(amount)`)
 *
 * The engines own all calldata + the allowance derivation; the allowance read
 * here is READ ONLY and only labels the approve step.
 */
export function useRewardsLaunch({
  flow,
  contractAddress,
  supplyToken,
  amount
}: RewardsEngineParams): UseRewardsLaunchResult {
  const { txCallbacks } = useTransaction();
  const { address } = useConnection();
  const chainId = useChainId();

  const shouldUseBatch = useShouldUseBatch();

  const isSupply = flow === 'supply';
  const supplyTokenAddress = supplyToken.address[chainId];
  const symbol = supplyToken.symbol;

  // READ ONLY — labels the approve step only. The approve/stake calls and their
  // allowance derivation live entirely inside useBatchRewardsSupply; TanStack
  // dedupes this read with the engine's own.
  const { data: allowance } = useTokenAllowance({
    chainId,
    contractAddress: supplyTokenAddress,
    owner: address,
    spender: contractAddress
  });
  const needsAllowance = isSupply && allowance !== undefined && allowance < amount;

  // Both engines are called unconditionally (hooks rules) and gated by
  // `enabled` to the active flow.
  const supplyHook = useBatchRewardsSupply({
    contractAddress,
    supplyTokenAddress,
    amount,
    ref: REFERRAL_CODE,
    enabled: isSupply,
    shouldUseBatch,
    ...txCallbacks
  });
  const withdrawHook = useRewardsWithdraw({
    contractAddress,
    amount,
    enabled: !isSupply,
    ...txCallbacks
  });

  const activeHook = isSupply ? supplyHook : withdrawHook;

  // Step labels mirror the engine's call count so the indicator advances in
  // lockstep (approve elided when the allowance already covers the amount).
  const steps = useMemo<string[]>(() => {
    if (!isSupply) return [t`Withdraw ${symbol}`];
    if (needsAllowance) return [t`Approve ${symbol}`, t`Supply ${symbol}`];
    return [t`Supply ${symbol}`];
  }, [isSupply, needsAllowance, symbol]);

  return toLaunchResult(activeHook, steps);
}
