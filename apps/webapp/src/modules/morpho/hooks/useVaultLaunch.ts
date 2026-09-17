import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { type Token, useBatchVaultDeposit, useVaultRedeem, useVaultWithdraw } from '@/hooks';
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
 * The seam between the redesigned vault modal and the (unmodified) ERC-4626
 * engine hooks — the vault analogue of `useSavingsLaunch`. Routes a flow + amount
 * to the correct engine, spreads the TransactionContext `txCallbacks` in, and
 * derives the step labels:
 *  - supply  → `useBatchVaultDeposit` (optional USDT reset → approve → deposit)
 *  - withdraw (specific) → `useVaultWithdraw` (burn shares for exact assets)
 *  - withdraw (Max)      → `useVaultRedeem` (redeem all shares, no dust)
 *
 * The engines own all calldata + the USDT reset-allowance derivation; the
 * supply steps are read off the engine's plan.
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
  const chainId = useChainId();

  const shouldUseBatch = useShouldUseBatch();

  const isSupply = flow === 'supply';
  const assetAddress = assetToken.address[chainId];
  const symbol = assetToken.symbol;

  // All three engines are called unconditionally (hooks rules) and gated by
  // `enabled` to the active flow.
  const depositHook = useBatchVaultDeposit({
    amount,
    vaultAddress,
    assetAddress: assetAddress!,
    enabled: isSupply,
    shouldUseBatch,
    ...txCallbacks
  });
  const withdrawHook = useVaultWithdraw({
    amount,
    vaultAddress,
    enabled: !isSupply && !max,
    ...txCallbacks
  });
  const redeemHook = useVaultRedeem({
    shares,
    vaultAddress,
    enabled: !isSupply && max,
    ...txCallbacks
  });

  const activeHook = isSupply ? depositHook : max ? redeemHook : withdrawHook;

  // Supply steps come off the engine's plan (the USDT reset → approve → supply
  // triple-step included), so an approve shows exactly when the engine sends one.
  const supplyPlan = depositHook.plan;
  const steps = useMemo<TransactionStep[]>(
    () =>
      isSupply
        ? stepsFromPlan(supplyPlan, [
            { reset: t`Reset allowance`, approve: t`Approve ${symbol}`, action: t`Supply ${symbol}` }
          ])
        : [t`Withdraw ${symbol}`],
    [isSupply, supplyPlan, symbol]
  );

  return toLaunchResult(activeHook, steps);
}
