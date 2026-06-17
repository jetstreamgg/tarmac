import { useCallback, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { t } from '@lingui/core/macro';
import { type Token, useBatchSavingsSupply, useSavingsAllowance } from '@/hooks';
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
 * Slice 01 (this file) wires mainnet USDS supply via `useBatchSavingsSupply`.
 * Later slices extend it with withdraw, DAI upgrade-and-supply, and the L2 PSM
 * paths — each routing to its own engine hook, never re-deriving calldata here.
 */
export function useSavingsLaunch({
  flow,
  originToken,
  amount,
  referralCode,
  transactionContent,
  onSuccess
}: UseSavingsLaunchParams): UseSavingsLaunchResult {
  const { launch: launchModal, txCallbacks } = useTransaction();

  const isSupply = flow === 'supply';

  // READ ONLY — used solely to label the modal's approve→supply steps. The
  // approve/deposit calls (and the USDT/allowance derivation, landmine #1) are
  // built entirely inside useBatchSavingsSupply; TanStack dedupes this read with
  // the engine's own.
  const { data: allowance } = useSavingsAllowance();
  const needsApproval = allowance !== undefined && allowance < amount;

  // Engine — the single source of truth for supply calldata. Unmodified; we only
  // route to it and spread the transaction context's callbacks.
  const supplyHook = useBatchSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isSupply,
    ...txCallbacks
  });
  const execute = supplyHook.execute;

  const launch = useCallback(() => {
    if (!isSupply) return; // withdraw lands in slice 02

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
      steps: needsApproval ? [t`Approve`, t`Supply`] : [t`Supply`],
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
  }, [
    isSupply,
    launchModal,
    amount,
    originToken.symbol,
    transactionContent,
    needsApproval,
    execute,
    onSuccess
  ]);

  return {
    launch,
    prepared: supplyHook.prepared,
    isLoading: supplyHook.isLoading,
    error: supplyHook.error
  };
}
