import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { formatUnits } from 'viem';
import { useChainId, useChains } from 'wagmi';
import { t } from '@lingui/core/macro';
import { useNetworkFee } from '@/hooks';
import { formatNumber } from '@/utils';
import { TxStatus } from '@/widgets';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { Text } from '@/modules/layout/components/Typography';
import { usePsmConversion, type UsePsmConversionResult } from './usePsmConversion';
import { getPsmDecimalsForDirection, type PsmConversionDirection } from './usePsmConversion.helpers';
import { ConvertReviewContent } from '../components/ConvertReviewContent';

const NO_VALUE = '–';

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
  steps: string[];
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
export function useConvertLaunch({
  direction,
  amount,
  onSuccess
}: UseConvertLaunchParams): UseConvertLaunchResult {
  const { launch: launchModal, updateModalContent, isModalOpen, txCallbacks, txStatus } = useTransaction();
  // Per-instance id so the provider ignores live updates from stale launches.
  const sessionId = useId();
  const chainId = useChainId();
  const chains = useChains();

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
  const networkName = chains.find(chain => chain.id === chainId)?.name ?? 'Ethereum';

  const steps = useMemo<string[]>(
    () =>
      conversion.needsAllowance
        ? [t`Approve ${originSymbol}`, t`Convert ${originSymbol} to ${targetSymbol}`]
        : [t`Convert ${originSymbol} to ${targetSymbol}`],
    [conversion.needsAllowance, originSymbol, targetSymbol]
  );

  const confirmDisabled =
    amount === 0n || !!conversion.disabledReason || !conversion.prepared || conversion.isLoading;

  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee } = useNetworkFee({
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
        chainId={chainId}
        networkName={networkName}
        networkFee={networkFee?.formatted ?? NO_VALUE}
      />
    ),
    [
      originSymbol,
      targetSymbol,
      amount,
      conversion.targetAmount,
      originDecimals,
      targetDecimals,
      chainId,
      networkName,
      networkFee?.formatted
    ]
  );

  const amountLabel = `${formatNumber(parseFloat(formatUnits(amount, originDecimals)), { maxDecimals: 2 })} ${originSymbol}`;
  const targetLabel = `${formatNumber(parseFloat(formatUnits(conversion.targetAmount, targetDecimals)), { maxDecimals: 2 })} ${targetSymbol}`;

  // Compact wallet/status-screen summary (Figma draws the amounts above the steps).
  const transactionScreenContent = useMemo(
    () => (
      <Text className="text-textSecondary text-sm" dataTestId="convert-modal-screen-summary">
        {amountLabel} → {targetLabel}
      </Text>
    ),
    [amountLabel, targetLabel]
  );

  const launch = useCallback(() => {
    launchModal({
      title: t`Review conversion`,
      transactionTitle: t`Confirm in the wallet`,
      subtitles: {
        loading: t`Your conversion is being processed on the blockchain. Please wait.`,
        success: t`You've successfully converted ${amountLabel} to ${targetSymbol}.`,
        error: t`An error occurred while converting your funds.`
      },
      toast: {
        loading: t`Converting ${amountLabel}`,
        success: t`${targetSymbol} converted!`,
        error: t`Conversion failed`
      },
      transactionContent,
      transactionScreenContent,
      steps,
      confirmLabel: t`Confirm`,
      confirmDisabled,
      onConfirm: () => executeRef.current(),
      onSuccess: handleSuccess,
      sessionId,
      analytics: {
        widgetName: 'convert',
        flow: direction === 'USDC_TO_USDS' ? 'usdc-to-usds' : 'usds-to-usdc',
        action: 'convert',
        data: {
          module: 'convert',
          originToken: originSymbol,
          targetToken: targetSymbol,
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
    handleSuccess,
    sessionId,
    direction,
    originSymbol,
    amount,
    originDecimals
  ]);

  // Keep the open modal's gating + preview live while it still sits on the
  // review screen (amounts can't change mid-review — the form is under the
  // overlay — but prepared/allowance state can). Once Confirm fires the content
  // freezes: the post-success form reset must not blank the executed amounts
  // on the wallet/status screens.
  useEffect(() => {
    if (!isModalOpen || txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, { transactionContent, transactionScreenContent, confirmDisabled, steps });
  }, [
    isModalOpen,
    txStatus,
    sessionId,
    updateModalContent,
    transactionContent,
    transactionScreenContent,
    confirmDisabled,
    steps
  ]);

  return { launch, conversion, steps };
}
