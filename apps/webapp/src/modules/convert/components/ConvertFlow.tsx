import { formatUnits } from 'viem';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { useTokenBalance } from '@/hooks';
import { formatNumber } from '@/utils';
import { REFERRAL_CODE, NO_VALUE } from '@/lib/constants';
import { useSession, useSettleOnEnd } from '@/modules/ui/context/TransactionContext';
import { TransactionModal } from '@/modules/ui/components/TransactionModal';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useTransactionRunActive } from '@/modules/ui/hooks/useTransactionRunActive';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';
import { enginePrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { usePsmConversion } from '../hooks/usePsmConversion';
import {
  getPsmConversionTokens,
  getPsmDecimalsForDirection,
  type PsmConversionDirection
} from '../hooks/usePsmConversion.helpers';
import { ConvertReviewContent } from './ConvertReviewContent';

const OPPOSITE: Record<PsmConversionDirection, PsmConversionDirection> = {
  USDC_TO_USDS: 'USDS_TO_USDC',
  USDS_TO_USDC: 'USDC_TO_USDS'
};

/**
 * The "Review conversion" flow, launched from the Convert page with the amount and
 * direction it was reviewed at. The PSM engine (`usePsmConversion`) routes mainnet
 * (UsdsPsmWrapper sellGem/buyGem) vs L2 (PSM3 swapExactIn) and owns every guard
 * (halted / liquidity / fee); its `execute` is the review's Confirm, so the
 * previewed figures and the calldata can never diverge.
 */
export function ConvertFlow({
  direction,
  amount,
  onSuccess
}: {
  direction: PsmConversionDirection;
  /** Exact-in amount at the origin token's decimals (USDC 6 / USDS 18). */
  amount: bigint;
  /** Refetch the page's balances / reset its form after a successful conversion. */
  onSuccess?: () => void;
}) {
  const { txCallbacks } = useSession();
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const [batchEnabled] = useBatchToggle();
  const runActive = useTransactionRunActive();

  const originDecimals = getPsmDecimalsForDirection(direction);
  const targetDecimals = getPsmDecimalsForDirection(OPPOSITE[direction]);

  // The page's balance check, re-read here: the review can sit open while the balance moves.
  const { data: originBalance } = useTokenBalance({
    chainId,
    address,
    token: getPsmConversionTokens(chainId, direction).originToken?.address
  });
  const insufficient =
    isConnected && amount > 0n && originBalance !== undefined && amount > originBalance.value;
  // Held on through a run the balance check no longer passes (see useTransactionRunActive).
  const enabled = !insufficient || runActive;

  const conversion = usePsmConversion({
    direction,
    amount,
    enabled,
    referralCode: REFERRAL_CODE,
    // The engine additionally gates on wallet support + needsAllowance.
    shouldUseBatch: !!batchEnabled,
    ...txCallbacks
  });

  const originSymbol = conversion.originToken?.symbol ?? '';
  const targetSymbol = conversion.targetToken?.symbol ?? '';
  const networkName = useNetworkName(chainId);

  // "Approve ◉ USDS" via the token chip, then "Convert ◉ USDS to ◉ USDC" via the
  // source→target pair chip (Figma 1036:205564).
  const convertStep: TransactionStep = {
    label: t`Convert`,
    tokenSymbol: originSymbol,
    targetTokenSymbol: targetSymbol,
    failureDetail: stepFailureDetail.convert(originSymbol)
  };
  const steps: TransactionStep[] = conversion.needsAllowance
    ? [
        {
          label: t`Approve`,
          tokenSymbol: originSymbol,
          failureDetail: stepFailureDetail.approve(originSymbol)
        },
        convertStep
      ]
    : [convertStep];

  const confirmDisabled =
    amount === 0n || !!conversion.disabledReason || !conversion.prepared || conversion.isLoading;
  const errorMessage = enginePrepareErrorMessage(conversion.prepared, amount > 0n ? conversion.error : null);

  // Read-only: the row shows a dash until this resolves, and Confirm never waits on it.
  const feeCell = useModalFeeCell({
    calls: conversion.calls,
    chainId,
    shouldUseBatch: conversion.isBatch,
    enabled: enabled && amount > 0n
  });

  // An approve that mined before a later leg failed must not reappear on the next
  // launch: the allowance read is 30s-stale, so refresh it once the run has cleared (APP-563 #3).
  useSettleOnEnd(conversion.reset, conversion.mutateAllowance);

  const formatted = (value: bigint, decimals: number) =>
    formatNumber(parseFloat(formatUnits(value, decimals)), { minDecimals: 2, maxDecimals: 2 });
  const amountLabel = `${formatNumber(parseFloat(formatUnits(amount, originDecimals)), { maxDecimals: 2 })} ${originSymbol}`;

  const { mutatePocketBalance } = conversion;
  // Engine reads (allowance / liquidity / halted flags) refetch before the page's own.
  const handleSuccess = () => {
    mutatePocketBalance();
    onSuccess?.();
  };

  return (
    <TransactionModal
      title={t`Review conversion`}
      // The wallet screen keeps the review title (Figma 1036:205564).
      transactionTitle={t`Review conversion`}
      toast={{
        loading: t`Converting ${amountLabel}`,
        success: t`${amountLabel} converted to ${targetSymbol}!`,
        error: t`Conversion failed`
      }}
      transactionContent={
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
      }
      transactionScreenContent={
        <TokenTransferHero
          from={{ symbol: originSymbol, amount: formatted(amount, originDecimals) }}
          to={{ symbol: targetSymbol, amount: formatted(conversion.targetAmount, targetDecimals) }}
          testId="convert-modal-screen-summary"
        />
      }
      steps={steps}
      confirmLabel={t`Confirm`}
      confirmDisabled={confirmDisabled}
      errorMessage={errorMessage}
      onConfirm={conversion.execute}
      onSuccess={handleSuccess}
      dispatch={{
        nextCalls: conversion.nextCalls,
        disabled: confirmDisabled,
        blocked: !!conversion.disabledReason
      }}
      // Both legs are $1-pegged (USDC/USDS), APP-517.
      usdValue={Number(formatUnits(amount, originDecimals))}
      analytics={{
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
      }}
    />
  );
}
