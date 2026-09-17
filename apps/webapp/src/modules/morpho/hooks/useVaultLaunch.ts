import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { type Token, useApproveThenAct, useTokenAllowance, useVaultRedeem, useVaultWithdraw } from '@/hooks';
import { usdtAbi, usdtAddress } from '@/hooks/generated';
import { buildVaultDepositCall } from '@/lib/vaults/buildVaultDepositCall';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { stepsFromPlan } from '@/modules/ui/components/transactionStepsModel';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';

export type VaultLaunchFlow = 'supply' | 'withdraw';

/** The engine inputs each surface (modal body) derives and spreads in. */
export interface VaultEngineParams {
  flow: VaultLaunchFlow;
  vaultAddress: `0x${string}`;
  assetToken: Token;
  amount: bigint;
  /** Withdraw Max → redeem the whole share balance (no dust). */
  max?: boolean;
  /** Share balance to redeem on a Max withdraw. */
  shares?: bigint;
}

export type UseVaultLaunchResult = EngineLaunchResult;

/**
 * The seam between the vault modal and the ERC-4626 engines:
 *  - supply  → USDT reset? → approve? → `deposit(assets, receiver)` (USDT
 *    refuses a nonzero → nonzero approve, so its allowance is reset first)
 *  - withdraw (specific) → `useVaultWithdraw` (burn shares for exact assets)
 *  - withdraw (Max)      → `useVaultRedeem` (redeem all shares, no dust)
 */
export function useVaultLaunch({
  flow,
  vaultAddress,
  assetToken,
  amount,
  max = false,
  shares = 0n
}: VaultEngineParams): UseVaultLaunchResult {
  const { txCallbacks } = useTransaction();
  const { address } = useConnection();
  const chainId = useChainId();
  const shouldUseBatch = useShouldUseBatch();

  const isSupply = flow === 'supply';
  const asset = assetToken.address[chainId];
  const symbol = assetToken.symbol;
  const isUsdt = asset === usdtAddress[chainId as keyof typeof usdtAddress];

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: asset,
    owner: address,
    spender: vaultAddress
  });

  const depositHook = useApproveThenAct({
    chainId,
    enabled: isSupply && amount !== 0n && !!vaultAddress && !!asset,
    shouldUseBatch,
    legs: [
      {
        approve: {
          token: asset,
          spender: vaultAddress,
          amount,
          allowance,
          allowanceError,
          resetFirst: isUsdt,
          abi: isUsdt ? usdtAbi : undefined
        },
        // receiver is the connected address — they receive the vault shares.
        calls: [buildVaultDepositCall({ vaultAddress, amount, receiver: address! })]
      }
    ],
    ...txCallbacks
  });
  const withdrawHook = useVaultWithdraw({ amount, vaultAddress, enabled: !isSupply && !max, ...txCallbacks });
  const redeemHook = useVaultRedeem({ shares, vaultAddress, enabled: !isSupply && max, ...txCallbacks });

  const plan = depositHook.plan;
  const steps = useMemo<TransactionStep[]>(
    () =>
      isSupply
        ? stepsFromPlan(plan, [
            { reset: t`Reset allowance`, approve: t`Approve ${symbol}`, action: t`Supply ${symbol}` }
          ])
        : [t`Withdraw ${symbol}`],
    [isSupply, plan, symbol]
  );

  return toLaunchResult(isSupply ? depositHook : max ? redeemHook : withdrawHook, steps);
}
