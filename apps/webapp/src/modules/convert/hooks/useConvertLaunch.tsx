import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
import { formatNumber } from '@/utils';
import { TxStatus } from '@/widgets';
import { REFERRAL_CODE, NO_VALUE } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { chainIdsForIntent } from '@/lib/chainAvailability';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { enginePrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import type { TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { usePsmConversion, type UsePsmConversionResult } from './usePsmConversion';
import { getPsmDecimalsForDirection, type PsmConversionDirection } from './usePsmConversion.helpers';
import { ConvertReviewContent } from '../components/ConvertReviewContent';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';

export interface UseConvertLaunchParams {
  direction: PsmConversionDirection;
  /** Exact-in amount at the origin token's decimals (USDC 6 / USDS 18). */
  amount: bigint;
  /** Refetch balances / reset the form after a successful conversion. */
  onSuccess?: () => void;
}

export interface UseConvertLaunchResult {
  /** Opens the "Review conversion" modal for the current direction + amount. */
  launch: () => void;
  /** The (unmodified) PSM engine state backing the launch — guards, amounts, tokens. */
  conversion: UsePsmConversionResult;
  /** Step labels: optional approve → convert, elided when allowance covers it. */
  steps: TransactionStep[];
}

/**
 * The single seam between the Convert page and `TransactionContext.launch()`
 * (mirrors `useSavingsLaunch`). One `usePsmConversion` instance receives the
 * context's `txCallbacks` and its `execute` becomes the modal's `onConfirm`, so the
 * previewed figures and the calldata can never diverge. The engine routes mainnet
 * (UsdsPsmWrapper sellGem/buyGem) vs L2 (PSM3 swapExactIn) internally and owns all
 * guards (halted / liquidity / fee) — this hook only describes the review modal.
 *
 * Review-first shape (the Pendle-redeem precedent): the swap form lives on the
 * page and stays mounted under the overlay, so the config carries only the
 * read-only `transactionContent` — no `entry`, no `backgroundContent`. While the
 * modal is open, `updateModalContent` keeps the confirm gating live.
 */
// Convert is a multi-chain product; the guard only fires on a chain that offers
// no Convert at all (APP-528). The page IS the widget, so a chain switch
// re-renders it against the new chain — the guard is a backstop.
const CONVERT_SUPPORTED_CHAIN_IDS = chainIdsForIntent(Intent.CONVERT_INTENT);

export function useConvertLaunch({
  direction,
  amount,
  onSuccess
}: UseConvertLaunchParams): UseConvertLaunchResult {
  const { launch: launchModal, updateModalContent, isModalOpen, txCallbacks, txStatus } = useTransaction();
  // Per-instance id so the provider ignores live updates from stale launches.
  const sessionId = useId();
  const chainId = useChainId();

  // Honour the user's batch toggle; the engine additionally gates on wallet
  // support + needsAllowance (a no-approval flow stays a single signature).
  const [batchEnabled] = useBatchToggle();

  const conversion = usePsmConversion({
    direction,
    amount,
    referralCode: REFERRAL_CODE,
    shouldUseBatch: !!batchEnabled,
    ...txCallbacks
  });

  const originSymbol = conversion.originToken?.symbol ?? '';
  const targetSymbol = conversion.targetToken?.symbol ?? '';
  const originDecimals = getPsmDecimalsForDirection(direction);
  const targetDecimals = getPsmDecimalsForDirection(
    direction === 'USDC_TO_USDS' ? 'USDS_TO_USDC' : 'USDC_TO_USDS'
  );
  const networkName = useNetworkName(chainId);

  // Step 1 renders "Approve ◉ USDS" via the steps model's tokenSymbol chip;
  // step 2 renders "Convert ◉ USDS to ◉ USDC" via the source→target pair chip
  // (Figma 1036:205564, two token icons side by side around a translated "to").
  const convertStep = useMemo<TransactionStep>(
    () => ({ label: t`Convert`, tokenSymbol: originSymbol, targetTokenSymbol: targetSymbol }),
    [originSymbol, targetSymbol]
  );
  const steps = useMemo<TransactionStep[]>(
    () =>
      conversion.needsAllowance
        ? [{ label: t`Approve`, tokenSymbol: originSymbol }, convertStep]
        : [convertStep],
    [conversion.needsAllowance, originSymbol, convertStep]
  );

  const confirmDisabled =
    amount === 0n || !!conversion.disabledReason || !conversion.prepared || conversion.isLoading;
  // This hook outlives the transaction (page-mounted), so pass null while the
  // form is idle — a stale execution error must not masquerade as a prepare
  // failure once the engine is disabled.
  const errorMessage = enginePrepareErrorMessage(conversion.prepared, amount > 0n ? conversion.error : null);

  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const feeCell = useModalFeeCell({
    calls: conversion.calls,
    chainId,
    shouldUseBatch: conversion.isBatch,
    enabled: amount > 0n
  });

  // Indirect onConfirm through a ref — the stored onConfirm can't be live-updated,
  // but the ref always points at the latest engine execute.
  const executeRef = useRef<() => void>(() => undefined);
  executeRef.current = () => conversion.execute();

  // Engine reads (allowance / liquidity / halted flags) refetch on success before
  // the page-level refetch (balances + form reset) runs.
  const { mutatePocketBalance } = conversion;
  const handleSuccess = useCallback(() => {
    mutatePocketBalance();
    onSuccess?.();
  }, [mutatePocketBalance, onSuccess]);

  // Both nodes are memoised on their data (the Pendle-redeem precedent): they sit
  // in the live-update effect's deps, and fresh identities every render would make
  // that effect re-push into the (unmemoised) provider on each of its re-renders —
  // a continuous update loop while the review modal is open.
  const transactionContent = useMemo(
    () => (
      <ConvertReviewContent
        originSymbol={originSymbol}
        targetSymbol={targetSymbol}
        originAmount={amount}
        targetAmount={conversion.targetAmount}
        originDecimals={originDecimals}
        targetDecimals={targetDecimals}
        networkName={networkName}
        networkFee={feeCell.fee?.formatted ?? NO_VALUE}
        feeCell={feeCell}
      />
    ),
    [
      originSymbol,
      targetSymbol,
      amount,
      conversion.targetAmount,
      originDecimals,
      targetDecimals,
      networkName,
      // useModalFeeCell memoizes on the scalar fee fields, so its identity moves
      // exactly when a value the fee row reads changes — the one dep the open
      // modal needs to pick up fee updates without re-opening the update loop.
      feeCell
    ]
  );

  const amountLabel = `${formatNumber(parseFloat(formatUnits(amount, originDecimals)), { maxDecimals: 2 })} ${originSymbol}`;

  // Wallet/status screen (Figma 1036:205564): the same from → to hero as the
  // review screen, above the Approve/Convert steps.
  const transactionScreenContent = useMemo(
    () => (
      <TokenTransferHero
        from={{
          symbol: originSymbol,
          amount: formatNumber(parseFloat(formatUnits(amount, originDecimals)), {
            minDecimals: 2,
            maxDecimals: 2
          })
        }}
        to={{
          symbol: targetSymbol,
          amount: formatNumber(parseFloat(formatUnits(conversion.targetAmount, targetDecimals)), {
            minDecimals: 2,
            maxDecimals: 2
          })
        }}
        testId="convert-modal-screen-summary"
      />
    ),
    [originSymbol, targetSymbol, amount, conversion.targetAmount, originDecimals, targetDecimals]
  );

  const launch = useCallback(() => {
    launchModal({
      title: t`Review conversion`,
      // The wallet screen keeps the review title (Figma 1036:205564 draws
      // "Review conversion" above the steps, not a "Confirm …" variant).
      transactionTitle: t`Review conversion`,
      subtitles: {
        loading: t`Your conversion is being processed on the blockchain. Please wait.`,
        success: t`You've successfully converted ${amountLabel} to ${targetSymbol}.`,
        error: t`An error occurred while converting your funds.`
      },
      toast: {
        loading: t`Converting ${amountLabel}`,
        success: t`${amountLabel} converted to ${targetSymbol}!`,
        error: t`Conversion failed`
      },
      transactionContent,
      transactionScreenContent,
      steps,
      confirmLabel: t`Confirm`,
      confirmDisabled,
      errorMessage,
      onConfirm: () => executeRef.current(),
      onSuccess: handleSuccess,
      sessionId,
      // Both legs are $1-pegged (USDC/USDS); the amount is fixed at launch
      // (enhanced screening, APP-517).
      usdValue: Number(formatUnits(amount, originDecimals)),
      supportedChainIds: CONVERT_SUPPORTED_CHAIN_IDS,
      analytics: {
        widgetName: 'convert',
        flow: direction === 'USDC_TO_USDS' ? 'usdc-to-usds' : 'usds-to-usdc',
        action: 'convert',
        data: {
          module: 'convert',
          // Legacy props kept verbatim: prod volume insights filter convert_module + direction.
          convert_module: 'psm',
          direction,
          originToken: originSymbol,
          targetToken: targetSymbol,
          isBatchTx: conversion.isBatch,
          amount: Number(formatUnits(amount, originDecimals))
        }
      }
    });
  }, [
    launchModal,
    amountLabel,
    targetSymbol,
    transactionContent,
    transactionScreenContent,
    steps,
    confirmDisabled,
    errorMessage,
    handleSuccess,
    sessionId,
    direction,
    originSymbol,
    amount,
    originDecimals,
    conversion.isBatch
  ]);

  // Keep the open modal's gating + preview live while it still sits on the
  // review screen (amounts can't change mid-review — the form is under the
  // overlay — but prepared/allowance state can). Once Confirm fires the content
  // freezes: the post-success form reset must not blank the executed amounts
  // on the wallet/status screens.
  useEffect(() => {
    if (!isModalOpen || txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, {
      transactionContent,
      transactionScreenContent,
      confirmDisabled,
      errorMessage,
      steps
    });
  }, [
    isModalOpen,
    txStatus,
    sessionId,
    updateModalContent,
    transactionContent,
    transactionScreenContent,
    confirmDisabled,
    errorMessage,
    steps
  ]);

  return { launch, conversion, steps };
}
