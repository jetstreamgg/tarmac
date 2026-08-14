import { useMemo } from 'react';
import type { Call } from 'viem';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  type Token,
  TOKENS,
  useBatchVaultDeposit,
  useIsBatchSupported,
  useTokenAllowance,
  useVaultRedeem,
  useVaultWithdraw,
  type VaultProvider
} from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';

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

export interface UseVaultLaunchResult {
  /** Fires the routed engine call directly (txCallbacks already spread in). */
  execute: () => void;
  /** Step labels for the configured flow, matching the engine's call count. */
  steps: string[];
  /** Whether the routed engine hook is ready to execute. */
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
  /** The routed engine's calls, for estimating the flow's network fee. */
  calls: Call[];
  /** Whether those calls go out bundled — the batch costs less than the sequence. */
  isBatch: boolean;
}

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

  // Honour the user's batch toggle: bundle approve+deposit into one EIP-5792 call
  // only when opted in AND supported. useTransactionFlow additionally gates on
  // calls.length > 1, so a no-approval supply stays a single signature.
  const [batchEnabled] = useBatchToggle();
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported;

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

  // Plain-write engines report a failed prepare simulation via `prepareError`
  // (the batch engines fold everything into `error`) — promote it so the modal
  // surfaces withdraw-simulation failures, the stUSDS launch precedent.
  const prepareError = 'prepareError' in activeHook ? (activeHook.prepareError as Error | null) : null;

  return {
    execute: activeHook.execute,
    steps,
    prepared: activeHook.prepared,
    isLoading: activeHook.isLoading,
    error: activeHook.error ?? prepareError,
    calls: activeHook.calls ?? [],
    isBatch: !!activeHook.isBatch
  };
}
