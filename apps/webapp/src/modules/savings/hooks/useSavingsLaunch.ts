import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  type Token,
  TOKENS,
  getWriteContractCall,
  sUsdsAddress,
  useApproveThenAct,
  useSavingsAllowance,
  useSavingsWithdraw,
  useTokenAllowance,
  type ApproveThenActLeg
} from '@/hooks';
import {
  daiUsdsAbi,
  daiUsdsAddress,
  mcdDaiAddress,
  psm3L2Address,
  usdsAddress,
  usdsPsmWrapperAbi,
  usdsPsmWrapperAddress
} from '@/hooks/generated';
import { sUsdsImplementationAbi } from '@/hooks/savings/useReadSavingsUsds';
import { psm3SwapExactInLeg, psm3SwapExactOutLeg } from '@/hooks/psm/psmLegs';
import { isL2ChainId, math } from '@/utils';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import {
  approveStep,
  stepFailureDetail,
  stepsFromPlan,
  type PlanLegSteps
} from '@/modules/ui/components/transactionStepsModel';
import { useUsdcSupplyGate } from './useUsdcSupplyGate';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';

export type SavingsLaunchFlow = 'supply' | 'withdraw';

export interface UseSavingsLaunchParams {
  flow: SavingsLaunchFlow;
  /** Origin token: USDS / DAI / USDC on mainnet, the L2 token (USDS / USDC) on L2s. */
  originToken: Token;
  amount: bigint;
  max?: boolean;
  /**
   * Referral code. Encoded as `number` on the mainnet `deposit` args and as
   * `bigint` on the L2 PSM `swapExactIn` args — converted per path. Do not
   * unify the types; calldata parity depends on this.
   */
  referralCode?: number;
  /** L2 PSM supply only: the minimum sUSDS out (slippage floor) for `swapExactIn`. */
  minAmountOut?: bigint;
  /**
   * L2 PSM withdraw only. `max` swaps the whole sUSDS balance out via
   * `swapExactIn(sUSDS → token)`; a specific amount caps the sUSDS in via
   * `swapExactOut(…, amountOut, maxAmountIn)`. All three come from the panel's
   * PSM preview reads:
   *  - `sUsdsBalance` — the whole sUSDS balance (max withdraw `amountIn`)
   *  - `minAmountOutForWithdrawAll` — the origin token floor for a max withdraw
   *  - `maxAmountInForWithdraw` — the sUSDS ceiling for a specific-amount withdraw
   */
  sUsdsBalance?: bigint;
  minAmountOutForWithdrawAll?: bigint;
  maxAmountInForWithdraw?: bigint;
}

export type UseSavingsLaunchResult = EngineLaunchResult;

/**
 * The seam between the Savings UI and the transaction engine. Given a flow +
 * origin token + amount it builds the legs for the active route, hands them to
 * one `useApproveThenAct`, and labels the steps off its plan:
 *  - supply + USDS (mainnet) → approve? → `deposit`
 *  - supply + DAI  (mainnet) → approve-DAI? → `daiToUsds` → approve-USDS? → `deposit`
 *  - supply + USDC (mainnet) → approve-USDC? → wrapper `sellGem` → approve-USDS? →
 *    `deposit`, armed only while `useUsdcSupplyGate` is open (see below)
 *  - supply        (L2)      → approve? → psm3 `swapExactIn(token → sUSDS)`
 *  - withdraw      (L2)      → approve(sUSDS)? → `swapExactIn` (max) / `swapExactOut`
 *  - withdraw      (mainnet) → `useSavingsWithdraw` (a plain write)
 *
 * The USDC route mints `amount * 1e12` USDS at a zero PSM fee, so its USDS legs
 * spend that widened wad; a nonzero `tin` would make `sellGem` under-deliver and
 * the sequential path would land the swap and then fail the deposit. The gate is
 * read HERE so nothing that routes through this seam can arm an ungated engine.
 */
export function useSavingsLaunch({
  flow,
  originToken,
  amount,
  max = false,
  referralCode,
  minAmountOut,
  sUsdsBalance,
  minAmountOutForWithdrawAll,
  maxAmountInForWithdraw
}: UseSavingsLaunchParams): UseSavingsLaunchResult {
  const { txCallbacks } = useTransaction();
  const { address } = useConnection();
  const chainId = useChainId();
  const shouldUseBatch = useShouldUseBatch();

  const isL2 = isL2ChainId(chainId);
  const isSupply = flow === 'supply';
  const isDai = isSupply && !isL2 && originToken.symbol === TOKENS.dai.symbol;
  const isMainnetUsdc = isSupply && !isL2 && originToken.symbol === TOKENS.usdc.symbol;
  const isL2Withdraw = !isSupply && isL2;

  const usdcGate = useUsdcSupplyGate();
  const usdcGateOpen = usdcGate.ready && !usdcGate.blockedReason;

  const usds = usdsAddress[chainId as keyof typeof usdsAddress];
  const sUsds = sUsdsAddress[chainId as keyof typeof sUsdsAddress];
  const dai = mcdDaiAddress[chainId as keyof typeof mcdDaiAddress];
  const daiUsds = daiUsdsAddress[chainId as keyof typeof daiUsdsAddress];
  const usdc = TOKENS.usdc.address[chainId];
  const wrapper = usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];
  const psm = psm3L2Address[chainId as keyof typeof psm3L2Address];

  // The allowance reads every route needs; each is disabled where its spender
  // has no address on this chain.
  const usdsAllowance = useSavingsAllowance();
  const daiAllowance = useTokenAllowance({ chainId, contractAddress: dai, owner: address, spender: daiUsds });
  const usdcAllowance = useTokenAllowance({
    chainId,
    contractAddress: usdc,
    owner: address,
    spender: wrapper
  });
  const psmInAllowance = useTokenAllowance({
    chainId,
    contractAddress: originToken.address[chainId],
    owner: address,
    spender: psm
  });
  const psmOutAllowance = useTokenAllowance({
    chainId,
    contractAddress: TOKENS.susds.address[chainId],
    owner: address,
    spender: psm
  });
  const read = ({ data, error }: { data?: bigint; error: Error | null }) => ({
    allowance: data,
    allowanceError: error
  });

  // L2 PSM referral is a bigint (mainnet deposit's is a number — do not unify).
  const psmReferralCode = referralCode ? BigInt(referralCode) : undefined;
  // The USDS the wrapper hands back for `amount` USDC at a zero fee.
  const usdsAmount = isMainnetUsdc ? math.convertUSDCtoWad(amount) : amount;

  const depositLeg = (): ApproveThenActLeg => ({
    approve: { token: usds, spender: sUsds, amount: usdsAmount, ...read(usdsAllowance) },
    calls: [
      getWriteContractCall({
        to: sUsds,
        abi: sUsdsImplementationAbi,
        functionName: 'deposit',
        args: [usdsAmount, address!, referralCode ?? 0]
      })
    ]
  });

  const legs: ApproveThenActLeg[] = isSupply
    ? isL2
      ? [
          psm3SwapExactInLeg({
            chainId,
            address,
            assetIn: originToken.address[chainId],
            assetOut: TOKENS.susds.address[chainId],
            amountIn: amount,
            minAmountOut: minAmountOut ?? 0n,
            referralCode: psmReferralCode,
            ...read(psmInAllowance)
          })
        ]
      : isDai
        ? [
            {
              approve: { token: dai, spender: daiUsds, amount, ...read(daiAllowance) },
              calls: [
                getWriteContractCall({
                  to: daiUsds,
                  abi: daiUsdsAbi,
                  functionName: 'daiToUsds',
                  args: [address!, amount]
                })
              ]
            },
            depositLeg()
          ]
        : isMainnetUsdc
          ? [
              {
                approve: { token: usdc, spender: wrapper, amount, ...read(usdcAllowance) },
                calls: [
                  getWriteContractCall({
                    to: wrapper,
                    abi: usdsPsmWrapperAbi,
                    functionName: 'sellGem',
                    args: [address!, amount]
                  })
                ]
              },
              depositLeg()
            ]
          : [depositLeg()]
    : isL2Withdraw
      ? max
        ? [
            psm3SwapExactInLeg({
              chainId,
              address,
              assetIn: TOKENS.susds.address[chainId],
              assetOut: originToken.address[chainId],
              amountIn: sUsdsBalance ?? 0n,
              minAmountOut: minAmountOutForWithdrawAll ?? 0n,
              referralCode: psmReferralCode,
              ...read(psmOutAllowance)
            })
          ]
        : [
            psm3SwapExactOutLeg({
              chainId,
              address,
              assetIn: TOKENS.susds.address[chainId],
              assetOut: originToken.address[chainId],
              amountOut: amount,
              maxAmountIn: maxAmountInForWithdraw ?? 0n,
              referralCode: psmReferralCode,
              ...read(psmOutAllowance)
            })
          ]
      : [];

  const legAmount = isL2Withdraw ? (max ? (sUsdsBalance ?? 0n) : (maxAmountInForWithdraw ?? 0n)) : amount;
  const engine = useApproveThenAct({
    legs,
    chainId,
    enabled: legs.length > 0 && legAmount !== 0n && (!isMainnetUsdc || (usdcGateOpen && !!usdc && !!wrapper)),
    shouldUseBatch,
    ...txCallbacks
  });
  const withdrawHook = useSavingsWithdraw({ amount, max, enabled: !isSupply && !isL2, ...txCallbacks });

  const activeHook = !isSupply && !isL2 ? withdrawHook : engine;
  const plan = engine.plan;

  const steps = useMemo<TransactionStep[]>(() => {
    const symbol = originToken.symbol;
    const supplyStep = (of: string): TransactionStep => ({
      label: t`Supply`,
      tokenSymbol: of,
      failureDetail: stepFailureDetail.supply(of)
    });
    const withdrawStep: TransactionStep = {
      label: t`Withdraw`,
      tokenSymbol: symbol,
      failureDetail: stepFailureDetail.withdraw(symbol)
    };
    const usdsSupplyLeg: PlanLegSteps = { approve: approveStep('USDS'), action: supplyStep('USDS') };

    if (!isSupply && !isL2) return [withdrawStep];
    const legSteps: PlanLegSteps[] = !isSupply
      ? // The withdraw approval is for the sUSDS share token, not `originToken` —
        // it keeps the bare label rather than a wrong chip.
        [
          {
            approve: { label: t`Approve`, failureDetail: stepFailureDetail.approve('sUSDS') },
            action: withdrawStep
          }
        ]
      : isL2
        ? [{ approve: approveStep(symbol), action: supplyStep(symbol) }]
        : isDai
          ? [{ approve: approveStep('DAI'), action: t`Upgrade DAI to USDS` }, usdsSupplyLeg]
          : isMainnetUsdc
            ? [{ approve: approveStep('USDC'), action: t`Convert USDC to USDS` }, usdsSupplyLeg]
            : [usdsSupplyLeg];
    return stepsFromPlan(plan, legSteps);
  }, [isSupply, isL2, isDai, isMainnetUsdc, originToken.symbol, plan]);

  return toLaunchResult(activeHook, steps);
}
