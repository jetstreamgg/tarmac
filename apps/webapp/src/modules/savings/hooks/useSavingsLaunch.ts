import { useCallback, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { useAccount, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  type Token,
  TOKENS,
  daiUsdsAddress,
  mcdDaiAddress,
  useBatchSavingsSupply,
  useBatchUpgradeAndSavingsSupply,
  useSavingsAllowance,
  useSavingsWithdraw,
  useTokenAllowance
} from '@/hooks';
import { formatBigInt } from '@/utils';
import { useTransaction } from '@/modules/ui/context/TransactionContext';

export type SavingsLaunchFlow = 'supply' | 'withdraw';

export interface UseSavingsLaunchParams {
  flow: SavingsLaunchFlow;
  /** Origin token: USDS / DAI on mainnet, the L2 token on L2s. */
  originToken: Token;
  amount: bigint;
  max?: boolean;
  referralCode?: number;
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
 * Routing (slices 01–03):
 *  - supply + USDS → `useBatchSavingsSupply` (optional approve → deposit)
 *  - supply + DAI  → `useBatchUpgradeAndSavingsSupply` (optional approve-DAI →
 *    daiToUsds → optional approve-USDS → deposit) — the multi-step path
 *  - withdraw      → `useSavingsWithdraw` (`max` resolves via maxWithdraw(owner))
 *
 * The engines own all calldata. Allowance reads here are READ ONLY — they label
 * the modal's approve steps; the approve/deposit calls (and the USDT/allowance
 * derivation, landmine #1) are built entirely inside the engine hooks.
 */
export function useSavingsLaunch({
  flow,
  originToken,
  amount,
  max = false,
  referralCode,
  transactionContent,
  onSuccess
}: UseSavingsLaunchParams): UseSavingsLaunchResult {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const { address } = useAccount();
  const chainId = useChainId();

  const isSupply = flow === 'supply';
  // Same branch condition the legacy useSavingsTransactions orchestrator uses.
  const isDai = isSupply && originToken.symbol === TOKENS.dai.symbol;

  // READ ONLY — used solely to label the modal's approve steps. The approve/deposit
  // calls (and the USDT/allowance derivation, landmine #1) are built entirely inside
  // the engine hooks; TanStack dedupes these reads with the engines' own.
  const { data: usdsAllowance } = useSavingsAllowance();
  const { data: daiAllowance } = useTokenAllowance({
    chainId,
    contractAddress: mcdDaiAddress[chainId as keyof typeof mcdDaiAddress],
    owner: address,
    spender: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
  });

  const needsUsdsApproval = isSupply && usdsAllowance !== undefined && usdsAllowance < amount;
  const needsDaiApproval = isDai && daiAllowance !== undefined && daiAllowance < amount;

  // Engines — the single source of truth for calldata. All three are called
  // unconditionally (React hooks rules) and gated by `enabled` to the active
  // flow + origin token; we only route to them and spread the context's callbacks.
  const supplyHook = useBatchSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isSupply && !isDai,
    ...txCallbacks
  });
  const upgradeHook = useBatchUpgradeAndSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isDai,
    ...txCallbacks
  });
  const withdrawHook = useSavingsWithdraw({
    amount,
    max,
    enabled: !isSupply,
    ...txCallbacks
  });

  const activeHook = isSupply ? (isDai ? upgradeHook : supplyHook) : withdrawHook;
  const execute = activeHook.execute;

  const launch = useCallback(() => {
    if (isSupply) {
      // Step labels mirror the engine's call count: the DAI path is up to 4 steps
      // (approve-DAI → upgrade → approve-USDS → supply), each approve elided when
      // its allowance is already present so the step indicator advances in lockstep.
      const steps = isDai
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
          review: t`You are supplying ${formatBigInt(amount)} ${originToken.symbol} to Sky Savings.`,
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
            amount: Number(formatUnits(amount, 18))
          }
        }
      });
    } else {
      launchModal({
        title: t`Withdraw from Sky Savings`,
        subtitles: {
          review: max
            ? t`You are withdrawing your entire position from Sky Savings.`
            : t`You are withdrawing ${formatBigInt(amount)} ${originToken.symbol} from Sky Savings.`,
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
    isDai,
    max,
    launchModal,
    amount,
    originToken.symbol,
    transactionContent,
    needsUsdsApproval,
    needsDaiApproval,
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
