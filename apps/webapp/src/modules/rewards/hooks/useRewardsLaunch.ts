import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  type Token,
  getWriteContractCall,
  useApproveThenAct,
  useRewardsWithdraw,
  useTokenAllowance,
  ZERO_ADDRESS
} from '@/hooks';
import { usdsSkyRewardAbi } from '@/hooks/generated';
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
 * The seam between the rewards modal and the engines:
 *  - supply   → approve? → `stake(amount, ref)` (every farm shares the ABI)
 *  - withdraw → `useRewardsWithdraw` (`withdraw(amount)`, a plain write)
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
  const token = supplyToken.address[chainId];
  const symbol = supplyToken.symbol;

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: token,
    spender: contractAddress,
    owner: address
  });

  const supplyHook = useApproveThenAct({
    chainId,
    enabled: isSupply && amount !== 0n && address !== ZERO_ADDRESS,
    shouldUseBatch,
    legs: [
      {
        approve: { token, spender: contractAddress, amount, allowance, allowanceError },
        calls:
          token && contractAddress
            ? [
                getWriteContractCall({
                  to: contractAddress,
                  abi: usdsSkyRewardAbi,
                  functionName: 'stake',
                  args: [amount, REFERRAL_CODE]
                })
              ]
            : []
      }
    ],
    ...txCallbacks
  });
  const withdrawHook = useRewardsWithdraw({ contractAddress, amount, enabled: !isSupply, ...txCallbacks });

  const plan = supplyHook.plan;
  const steps = useMemo<TransactionStep[]>(
    () =>
      isSupply
        ? stepsFromPlan(plan, [{ approve: t`Approve ${symbol}`, action: t`Supply ${symbol}` }])
        : [t`Withdraw ${symbol}`],
    [isSupply, plan, symbol]
  );

  return toLaunchResult(isSupply ? supplyHook : withdrawHook, steps);
}
