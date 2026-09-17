import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { Abi } from 'viem';
import { t } from '@lingui/core/macro';
import {
  StUsdsProviderType,
  getWriteContractCall,
  useApproveThenAct,
  useCurveAllowance,
  useStUsdsAllowance,
  useStUsdsWithdraw,
  type ApproveThenActLeg
} from '@/hooks';
import {
  curveStUsdsUsdsPoolAbi,
  curveStUsdsUsdsPoolAddress,
  stUsdsAddress,
  stUsdsImplementationAbi,
  usdsAddress
} from '@/hooks/generated';
import { useCurvePoolData } from '@/hooks/stusds/providers/useCurvePoolData';
import { calculateMinOutputWithSlippage } from '@/hooks/stusds/providers/rateComparison';
import { STUSDS_PROVIDER_CONFIG } from '@/hooks/stusds/providers/constants';
import { REFERRAL_CODE } from '@/lib/constants';
import { familyMainnetId } from '@/utils';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { stepsFromPlan } from '@/modules/ui/components/transactionStepsModel';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';

export type StUsdsLaunchFlow = 'supply' | 'withdraw';

/** The engine inputs the modal body derives and spreads in. */
export interface StUsdsEngineParams {
  flow: StUsdsLaunchFlow;
  /** USDS amount — the input on supply, the desired output on withdraw. */
  amount: bigint;
  /** Withdraw Max → the native engine redeems the whole share balance (no dust). */
  max?: boolean;
  /** Routing decision from `useStUsdsProviderSelection` (native vs Curve). */
  selectedProvider: StUsdsProviderType;
  /** Quoted output for the selected route (stUSDS on supply, USDS on withdraw). */
  expectedOutput: bigint;
  /** Curve withdrawals: the stUSDS input the quote says is needed for `amount` USDS. */
  stUsdsAmount?: bigint;
}

export type UseStUsdsLaunchResult = EngineLaunchResult;

/**
 * The seam between the stUSDS modal and the engines, with the provider routing
 * the retired StUSDSWidget performed:
 *  - supply, native   → approve? → `deposit(amount, user[, referral])`
 *  - supply, Curve    → approve(USDS)? → pool `exchange` at the config slippage
 *  - withdraw, native → `useStUsdsWithdraw` (Max redeems shares to avoid dust)
 *  - withdraw, Curve  → approve(stUSDS)? → pool `exchange` (stUSDS input from the quote)
 *
 * The Curve swap is still "Supply"/"Withdraw" to the user — the route is
 * communicated by the provider notice, not the step names.
 */
export function useStUsdsLaunch({
  flow,
  amount,
  max = false,
  selectedProvider,
  expectedOutput,
  stUsdsAmount
}: StUsdsEngineParams): UseStUsdsLaunchResult {
  const { txCallbacks } = useTransaction();
  const { address } = useConnection();
  const connectedChainId = useChainId();
  // The Curve pool lives on the family's mainnet; the native vault on the connected chain.
  const curveChainId = familyMainnetId(connectedChainId);
  const shouldUseBatch = useShouldUseBatch();

  const isSupply = flow === 'supply';
  const isCurve = selectedProvider === StUsdsProviderType.CURVE;

  const chainId = isCurve ? curveChainId : connectedChainId;
  const usds = usdsAddress[chainId as keyof typeof usdsAddress];
  const stUsds = stUsdsAddress[chainId as keyof typeof stUsdsAddress];
  const pool = curveStUsdsUsdsPoolAddress[curveChainId as keyof typeof curveStUsdsUsdsPoolAddress];

  const nativeAllowance = useStUsdsAllowance();
  // Curve input: USDS on supply, the quoted stUSDS on withdraw. minOut must
  // derive from the same quote that produced stUsdsAmount: on a max withdraw the
  // UI amount and the routed quote are seeded by separate provider selections
  // and can diverge.
  const curveInput = isSupply ? amount : (stUsdsAmount ?? 0n);
  const curveAllowance = useCurveAllowance({ token: isSupply ? 'USDS' : 'stUSDS', amount: curveInput });
  const { data: poolData } = useCurvePoolData();

  let legs: ApproveThenActLeg[] = [];
  if (isSupply && !isCurve) {
    legs = [
      {
        approve: {
          token: usds,
          spender: stUsds,
          amount,
          allowance: nativeAllowance.data,
          allowanceError: nativeAllowance.error
        },
        calls: [
          getWriteContractCall({
            to: stUsds,
            abi: stUsdsImplementationAbi as Abi,
            functionName: 'deposit',
            args: [amount, address!, ...(REFERRAL_CODE > 0 ? [REFERRAL_CODE] : [])] as const
          })
        ]
      }
    ];
  } else if (isCurve) {
    // Token indices come from the pool; the fallbacks are the pool's known order.
    const usdsIndex = BigInt(poolData?.tokenIndices.usds ?? 0);
    const stUsdsIndex = BigInt(poolData?.tokenIndices.stUsds ?? 1);
    const [i, j] = isSupply ? [usdsIndex, stUsdsIndex] : [stUsdsIndex, usdsIndex];
    legs = [
      {
        approve: {
          token: isSupply ? usds : stUsds,
          spender: pool,
          amount: curveInput,
          allowance: curveAllowance.data,
          allowanceError: curveAllowance.error
        },
        calls: address
          ? [
              getWriteContractCall({
                to: pool,
                abi: curveStUsdsUsdsPoolAbi as Abi,
                functionName: 'exchange',
                args: [
                  i,
                  j,
                  curveInput,
                  calculateMinOutputWithSlippage(expectedOutput, STUSDS_PROVIDER_CONFIG.maxSlippageBps),
                  address
                ]
              })
            ]
          : []
      }
    ];
  }

  const engine = useApproveThenAct({
    chainId,
    legs,
    enabled: legs.length > 0 && curveInput > 0n && (!isCurve || (!!poolData && expectedOutput > 0n)),
    shouldUseBatch,
    ...txCallbacks
  });
  const nativeWithdraw = useStUsdsWithdraw({ amount, max, enabled: !isSupply && !isCurve, ...txCallbacks });

  const plan = engine.plan;
  const steps = useMemo<TransactionStep[]>(() => {
    if (isSupply) return stepsFromPlan(plan, [{ approve: t`Approve USDS`, action: t`Supply USDS` }]);
    if (!isCurve) return [t`Withdraw USDS`];
    return stepsFromPlan(plan, [{ approve: t`Approve stUSDS`, action: t`Withdraw USDS` }]);
  }, [isSupply, isCurve, plan]);

  return toLaunchResult(!isSupply && !isCurve ? nativeWithdraw : engine, steps);
}
