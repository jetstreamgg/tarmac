import { useCallback, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { t } from '@lingui/core/macro';
import { type Token, useBatchSavingsSupply, useSavingsAllowance, useSavingsWithdraw } from '@/hooks';
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
 * Slice 01 wired mainnet USDS supply via `useBatchSavingsSupply`; slice 02 adds
 * the withdraw branch via `useSavingsWithdraw`. Later slices extend it with DAI
 * upgrade-and-supply and the L2 PSM paths — each routing to its own engine hook,
 * never re-deriving calldata here.
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

  const isSupply = flow === 'supply';

  // READ ONLY — used solely to label the modal's approve→supply steps. The
  // approve/deposit calls (and the USDT/allowance derivation, landmine #1) are
  // built entirely inside useBatchSavingsSupply; TanStack dedupes this read with
  // the engine's own.
  const { data: allowance } = useSavingsAllowance();
  const needsApproval = isSupply && allowance !== undefined && allowance < amount;

  // Engines — the single source of truth for calldata. Both are called
  // unconditionally (React hooks rules) and gated by `enabled` to the active
  // flow; we only route to them and spread the context's callbacks. The withdraw
  // amount (including the `max` → maxWithdraw(owner) resolution, landmine #1)
  // stays entirely inside useSavingsWithdraw.
  const supplyHook = useBatchSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isSupply,
    ...txCallbacks
  });
  const withdrawHook = useSavingsWithdraw({
    amount,
    max,
    enabled: !isSupply,
    ...txCallbacks
  });

  const activeHook = isSupply ? supplyHook : withdrawHook;
  const execute = activeHook.execute;

  const launch = useCallback(() => {
    if (isSupply) {
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
    max,
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
    prepared: activeHook.prepared,
    isLoading: activeHook.isLoading,
    error: activeHook.error
  };
}
