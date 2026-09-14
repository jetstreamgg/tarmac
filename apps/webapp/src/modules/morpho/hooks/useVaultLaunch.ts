import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  type Token,
  useBatchVaultDeposit,
  useVaultRedeem,
  useVaultWithdraw,
  type VaultProvider
} from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';
import { useApproveSteps } from '@/modules/ui/hooks/useApproveSteps';

export type VaultLaunchFlow = 'supply' | 'withdraw';

/** The engine inputs each surface (modal body) derives and spreads in. */
export interface VaultEngineParams {
  flow: VaultLaunchFlow;
  vaultAddress: `0x${string}`;
  assetToken: Token;
  provider?: VaultProvider;
  amount: bigint;
  /** Withdraw Max → redeem the whole share balance (no dust). */
  max?: boolean;
  /** Share balance to redeem on a Max withdraw. */
  shares?: bigint;
}

type UseVaultLaunchResult = EngineLaunchResult;

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
 * allowance read here is READ ONLY and only labels the approve steps.
 */
export function useVaultLaunch({
  flow,
  vaultAddress,
  assetToken,
  provider = 'morpho',
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

  // READ ONLY — labels the approve steps only (the USDT reset → approve → supply
  // triple-step carried forward). The approve/deposit calls and the USDT reset
  // derivation live entirely inside useBatchVaultDeposit.
  const supplySteps = useApproveSteps({
    token: assetToken,
    spender: vaultAddress,
    amount,
    enabled: isSupply,
    action: t`Supply ${symbol}`,
    withUsdtReset: true
  });

  // All three engines are called unconditionally (hooks rules) and gated by
  // `enabled` to the active flow.
  const depositHook = useBatchVaultDeposit({
    amount,
    vaultAddress,
    assetAddress: assetAddress!,
    provider,
    referral: REFERRAL_CODE,
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

  // Step labels mirror the engine's call count so the indicator advances in
  // lockstep.
  const steps = useMemo<string[]>(
    () => (isSupply ? supplySteps : [t`Withdraw ${symbol}`]),
    [isSupply, supplySteps, symbol]
  );

  return toLaunchResult(activeHook, steps);
}
