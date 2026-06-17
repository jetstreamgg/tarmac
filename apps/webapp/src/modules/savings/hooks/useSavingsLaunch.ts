import { useCallback, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { useAccount, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  type Token,
  TOKENS,
  daiUsdsAddress,
  getTokenDecimals,
  mcdDaiAddress,
  psm3L2Address,
  useBatchPsmSwapExactIn,
  useBatchSavingsSupply,
  useBatchUpgradeAndSavingsSupply,
  useSavingsAllowance,
  useSavingsWithdraw,
  useTokenAllowance
} from '@/hooks';
import { formatBigInt, isL2ChainId } from '@/utils';
import { useTransaction } from '@/modules/ui/context/TransactionContext';

export type SavingsLaunchFlow = 'supply' | 'withdraw';

export interface UseSavingsLaunchParams {
  flow: SavingsLaunchFlow;
  /** Origin token: USDS / DAI on mainnet, the L2 token (USDS / USDC) on L2s. */
  originToken: Token;
  amount: bigint;
  max?: boolean;
  /**
   * Referral code. Encoded as `number` on the mainnet `deposit` args and as
   * `bigint` on the L2 PSM `swapExactIn` args — the orchestrator converts per
   * path. Do not unify the types; calldata parity depends on this.
   */
  referralCode?: number;
  /**
   * L2 PSM supply only: the minimum sUSDS out (slippage floor) for
   * `swapExactIn`. Computed by the panel from chi (see
   * `useSavingsSupplyMinAmountOut`) and passed straight through to the engine.
   */
  minAmountOut?: bigint;
  /** Review-screen body; the panel passes a token/amount preview. */
  transactionContent?: ReactNode;
  /** Refetch position / balances after a successful transaction. */
  onSuccess?: () => void;
}

export interface UseSavingsLaunchResult {
  /** Opens the standard review modal for the configured flow. */
  launch: () => void;
  /** Whether the routed call-builder hook is ready to execute. */
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * The single seam between the redesigned Savings UI and
 * `TransactionContext.launch()`. Given a flow + origin token + amount it routes
 * to the correct (unmodified) call-builder engine hook, spreads the context's
 * `txCallbacks` into it, and describes the review modal.
 *
 * Routing (slices 01–04):
 *  - supply + USDS (mainnet) → `useBatchSavingsSupply` (optional approve → deposit)
 *  - supply + DAI  (mainnet) → `useBatchUpgradeAndSavingsSupply` (optional approve-DAI →
 *    daiToUsds → optional approve-USDS → deposit) — the multi-step path
 *  - supply        (L2)      → `useBatchPsmSwapExactIn` (optional approve →
 *    psm.swapExactIn(token → sUSDS), referralCode as bigint)
 *  - withdraw      (mainnet) → `useSavingsWithdraw` (`max` resolves via maxWithdraw(owner))
 *
 * The engines own all calldata. Allowance reads here are READ ONLY — they label
 * the modal's approve steps; the approve/deposit/swap calls (and the USDT/allowance
 * derivation, landmine #1) are built entirely inside the engine hooks.
 */
export function useSavingsLaunch({
  flow,
  originToken,
  amount,
  max = false,
  referralCode,
  minAmountOut,
  transactionContent,
  onSuccess
}: UseSavingsLaunchParams): UseSavingsLaunchResult {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const { address } = useAccount();
  const chainId = useChainId();

  const isL2 = isL2ChainId(chainId);
  const isSupply = flow === 'supply';
  // Same branch condition the legacy useSavingsTransactions orchestrator uses.
  // DAI is a mainnet-only origin; on L2 the PSM path takes precedence.
  const isDai = isSupply && !isL2 && originToken.symbol === TOKENS.dai.symbol;
  const originDecimals = getTokenDecimals(originToken, chainId);

  // READ ONLY — used solely to label the modal's approve steps. The approve/deposit/swap
  // calls (and the USDT/allowance derivation, landmine #1) are built entirely inside
  // the engine hooks; TanStack dedupes these reads with the engines' own.
  const { data: usdsAllowance } = useSavingsAllowance();
  const { data: daiAllowance } = useTokenAllowance({
    chainId,
    contractAddress: mcdDaiAddress[chainId as keyof typeof mcdDaiAddress],
    owner: address,
    spender: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
  });
  // L2 PSM assetIn → psm3L2 allowance (disabled on mainnet: spender undefined).
  const { data: psmAllowance } = useTokenAllowance({
    chainId,
    contractAddress: originToken.address[chainId],
    owner: address,
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address]
  });

  const needsUsdsApproval = isSupply && usdsAllowance !== undefined && usdsAllowance < amount;
  const needsDaiApproval = isDai && daiAllowance !== undefined && daiAllowance < amount;
  const needsPsmApproval = isSupply && isL2 && psmAllowance !== undefined && psmAllowance < amount;

  // L2 PSM referral is a bigint (mainnet deposit's is a number — do not unify).
  const psmReferralCode = referralCode ? BigInt(referralCode) : undefined;

  // Engines — the single source of truth for calldata. All four are called
  // unconditionally (React hooks rules) and gated by `enabled` to the active
  // flow + origin token + network; we only route to them and spread the callbacks.
  const supplyHook = useBatchSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isSupply && !isL2 && !isDai,
    ...txCallbacks
  });
  const upgradeHook = useBatchUpgradeAndSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isDai,
    ...txCallbacks
  });
  const psmSupplyHook = useBatchPsmSwapExactIn({
    assetIn: originToken.address[chainId],
    assetOut: TOKENS.susds.address[chainId],
    amountIn: amount,
    minAmountOut: minAmountOut ?? 0n,
    referralCode: psmReferralCode,
    enabled: isSupply && isL2,
    ...txCallbacks
  });
  const withdrawHook = useSavingsWithdraw({
    amount,
    max,
    enabled: !isSupply,
    ...txCallbacks
  });

  const activeHook = isSupply ? (isL2 ? psmSupplyHook : isDai ? upgradeHook : supplyHook) : withdrawHook;
  const execute = activeHook.execute;

  const launch = useCallback(() => {
    if (isSupply) {
      // Step labels mirror the engine's call count: the DAI path is up to 4 steps
      // (approve-DAI → upgrade → approve-USDS → supply), each approve elided when
      // its allowance is already present so the step indicator advances in lockstep.
      // L2 PSM supply is the simple approve(assetIn → psm3L2) → swap path.
      const steps = isL2
        ? needsPsmApproval
          ? [t`Approve`, t`Supply`]
          : [t`Supply`]
        : isDai
          ? ([
              needsDaiApproval && t`Approve DAI`,
              t`Upgrade DAI to USDS`,
              needsUsdsApproval && t`Approve USDS`,
              t`Supply USDS`
            ].filter(Boolean) as string[])
          : needsUsdsApproval
            ? [t`Approve`, t`Supply`]
            : [t`Supply`];
      launchModal({
        title: t`Supply to Sky Savings`,
        subtitles: {
          review: t`You are supplying ${formatBigInt(amount, { unit: originDecimals })} ${originToken.symbol} to Sky Savings.`,
          pending: t`Please confirm the transaction in your wallet.`,
          loading: t`Your supply is being processed on the blockchain. Please wait.`,
          success: t`You've successfully supplied to Sky Savings.`,
          error: t`An error occurred while supplying to Sky Savings.`
        },
        transactionContent,
        steps,
        confirmLabel: t`Supply`,
        onConfirm: execute,
        onSuccess,
        analytics: {
          widgetName: 'savings',
          flow: 'supply',
          action: 'supply',
          data: {
            module: 'savings',
            originToken: originToken.symbol,
            amount: Number(formatUnits(amount, originDecimals))
          }
        }
      });
    } else {
      launchModal({
        title: t`Withdraw from Sky Savings`,
        subtitles: {
          review: max
            ? t`You are withdrawing your entire position from Sky Savings.`
            : t`You are withdrawing ${formatBigInt(amount, { unit: originDecimals })} ${originToken.symbol} from Sky Savings.`,
          pending: t`Please confirm the transaction in your wallet.`,
          loading: t`Your withdrawal is being processed on the blockchain. Please wait.`,
          success: t`You've successfully withdrawn from Sky Savings.`,
          error: t`An error occurred while withdrawing from Sky Savings.`
        },
        transactionContent,
        // Withdraw is a single signature — you already own the sUSDS, no approve.
        steps: [t`Withdraw`],
        confirmLabel: t`Withdraw`,
        onConfirm: execute,
        onSuccess,
        analytics: {
          widgetName: 'savings',
          flow: 'withdraw',
          action: 'withdraw',
          data: {
            module: 'savings',
            originToken: originToken.symbol,
            amount: Number(formatUnits(amount, 18))
          }
        }
      });
    }
  }, [
    isSupply,
    isL2,
    isDai,
    max,
    launchModal,
    amount,
    originToken.symbol,
    originDecimals,
    transactionContent,
    needsUsdsApproval,
    needsDaiApproval,
    needsPsmApproval,
    execute,
    onSuccess
  ]);

  return {
    launch,
    prepared: activeHook.prepared,
    isLoading: activeHook.isLoading,
    error: activeHook.error
  };
}
