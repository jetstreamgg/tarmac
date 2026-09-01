import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  type Token,
  TOKENS,
  useBatchVaultDeposit,
  useTokenAllowance,
  useVaultRedeem,
  useVaultWithdraw,
  type VaultProvider
} from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';

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
  const { address } = useConnection();
  const chainId = useChainId();

  const shouldUseBatch = useShouldUseBatch();

  const isSupply = flow === 'supply';
  const assetAddress = assetToken.address[chainId];
  const isUsdt = assetToken.symbol === TOKENS.usdt.symbol;
  const symbol = assetToken.symbol;

  // READ ONLY — labels the approve steps only. The approve/deposit calls and the
  // USDT reset derivation live entirely inside useBatchVaultDeposit; TanStack
  // dedupes this read with the engine's own.
  const { data: allowance } = useTokenAllowance({
    chainId,
    contractAddress: assetAddress,
    owner: address,
    spender: vaultAddress
  });
  const needsAllowance = isSupply && allowance !== undefined && allowance < amount;
  // USDT must be reset to 0 before a new approval when a non-zero allowance exists.
  const needsReset = needsAllowance && isUsdt && (allowance ?? 0n) > 0n;

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
  // lockstep (USDT reset → approve → supply is the triple-step carried forward).
  const steps = useMemo<string[]>(() => {
    if (!isSupply) return [t`Withdraw ${symbol}`];
    if (needsReset) return [t`Reset allowance`, t`Approve ${symbol}`, t`Supply ${symbol}`];
    if (needsAllowance) return [t`Approve ${symbol}`, t`Supply ${symbol}`];
    return [t`Supply ${symbol}`];
  }, [isSupply, needsReset, needsAllowance, symbol]);

  return toLaunchResult(activeHook, steps);
}
