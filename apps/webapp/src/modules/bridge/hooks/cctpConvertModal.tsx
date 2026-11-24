import { t } from '@lingui/core/macro';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import type { TransactionConfig } from '@/modules/ui/context/transactionContract';
import { formatBigInt } from '@/utils';
import { CctpConvertReview } from '../components/CctpConvertReview';

// A convert's sale step names both tokens (Figma 96).
export const convertStep = (): TransactionStep => ({
  label: t`Convert`,
  tokenSymbol: 'USDC',
  targetTokenSymbol: 'USDS',
  failureDetail: stepFailureDetail.convert('USDC')
});

/** A convert's steps, one per call: the approve when short, then the sale. */
export const convertSteps = (calls: readonly unknown[]): TransactionStep[] =>
  calls.map(call =>
    (call as { functionName?: string }).functionName === 'approve'
      ? { label: t`Approve`, tokenSymbol: 'USDC', failureDetail: stepFailureDetail.approve('USDC') }
      : convertStep()
  );

/** The toast of a convert of `amount`, already formatted, USDC. */
export const convertToast = (amount: string) => ({
  loading: t`Converting ${amount} USDC to USDS`,
  success: t`Funds converted successfully!`,
  error: t`Conversion failed`
});

/**
 * The modal of a convert of `amount` USDC (6 decimals) out of a bridge's
 * `bridged` USDC, on `chainId`: reviewed first (Figma 94, 95), and its wallet
 * screen keeps the title (Figma 96). Its calls are priced once prepared.
 */
export const cctpConvertModal = ({
  amount,
  bridged,
  chainId
}: {
  amount: bigint;
  bridged: bigint;
  chainId: number;
}) => {
  const shown = formatBigInt(amount, { unit: 6, minDecimals: 2, maxDecimals: 2 });
  return {
    title: t`Review conversion`,
    transactionTitle: t`Review conversion`,
    confirmLabel: t`Confirm`,
    transactionContent: (
      <CctpConvertReview amount={amount} bridged={bridged} chainId={chainId} calls={[]} isBatch={false} />
    ),
    transactionScreenContent: (
      <TokenTransferHero
        from={{ symbol: 'USDC', amount: shown }}
        to={{ symbol: 'USDS', amount: shown }}
        testId="bridge-convert-amount"
      />
    ),
    steps: [convertStep()],
    toast: convertToast(shown)
  } satisfies Partial<TransactionConfig>;
};
