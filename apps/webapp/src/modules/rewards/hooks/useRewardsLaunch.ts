import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { type Token, useBatchRewardsSupply, useRewardsWithdraw } from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { stepsFromPlan } from '@/modules/ui/components/transactionStepsModel';
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
 * The engines own all calldata + the allowance derivation; the supply steps are
 * read off the engine's plan.
 */
export function useRewardsLaunch({
  flow,
  contractAddress,
  supplyToken,
  amount
}: RewardsEngineParams): UseRewardsLaunchResult {
  const { txCallbacks } = useTransaction();
  const chainId = useChainId();

  const shouldUseBatch = useShouldUseBatch();

  const isSupply = flow === 'supply';
  const supplyTokenAddress = supplyToken.address[chainId];
  const symbol = supplyToken.symbol;

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

  // Supply steps come off the engine's plan, so an approve shows exactly when
  // the engine sends one.
  const supplyPlan = supplyHook.plan;
  const steps = useMemo<TransactionStep[]>(
    () =>
      isSupply
        ? stepsFromPlan(supplyPlan, [{ approve: t`Approve ${symbol}`, action: t`Supply ${symbol}` }])
        : [t`Withdraw ${symbol}`],
    [isSupply, supplyPlan, symbol]
  );

  return toLaunchResult(activeHook, steps);
}
