import { t } from '@lingui/core/macro';
import { TxStatus } from '@/widgets/shared/constants';
import type { StepState } from '@/components/ui/steps';

/**
 * One entry of a flow's step list. The plain-string form is a bare label; the
 * object form adds the token rendered as an icon+symbol chip after the label
 * (DS Steps pattern, Figma 5200:30561) — e.g. `{ label: "Approve", tokenSymbol:
 * "SKY" }` renders "Approve ◉ SKY".
 */
export type TransactionStep =
  | string
  | {
      label: string;
      tokenSymbol?: string;
      /**
       * Flow-specific sentence appended after the generic rollback copy when
       * this step fails — e.g. "The USDS hasn't been approved." (Figma
       * 1030:139111 failure states).
       */
      failureDetail?: string;
    };

export type TransactionStepItem = {
  stepNumber: number;
  label: string;
  tokenSymbol?: string;
  state: StepState;
  /** Grey helper paragraph under the label (failure copy). */
  description?: string;
  /** Where the "Try again" pill renders: on the failed row, or filling the next step slot (bundled). */
  retry?: 'trailing' | 'slot';
};

type DeriveInput = {
  steps: TransactionStep[];
  currentStep: number;
  txStatus: TxStatus;
  bundled: boolean;
};

/**
 * Maps a flow's step list + transaction progress to the per-row view state the
 * modal renders (DS Steps pattern). Standard flows advance one step per tx;
 * bundled flows mark every step active while the single bundle is in flight,
 * then complete together.
 */
export function deriveTransactionStepItems({
  steps,
  currentStep,
  txStatus,
  bundled
}: DeriveInput): TransactionStepItem[] {
  const allDone = txStatus === TxStatus.SUCCESS;
  const failed = txStatus === TxStatus.ERROR;

  // Bundled failure (Figma 1030:139111): the bundle fails as one unit, so the
  // list collapses to a failed summary slot plus a slot holding the retry pill —
  // the flow's own steps reappear once the retry restarts the bundle.
  if (failed && bundled) {
    return [
      {
        stepNumber: 1,
        label: t`Transaction failed`,
        tokenSymbol: undefined,
        state: 'failed',
        description: t`The network rolled back your transaction. Try again and confirm bundled transaction in your wallet.`
      },
      { stepNumber: 2, label: '', tokenSymbol: undefined, state: 'active', retry: 'slot' }
    ];
  }

  return steps.map((step, i) => {
    const { label, tokenSymbol, failureDetail } =
      typeof step === 'string' ? { label: step, tokenSymbol: undefined, failureDetail: undefined } : step;

    // Standard failure (Figma 1030:139111): the step the engine stopped on
    // retitles, moves its token into the description, and carries the inline
    // retry; earlier steps keep their completions, later ones stay upcoming.
    if (failed && !bundled && i === currentStep) {
      const rolledBack = t`The network rolled back your transaction.`;
      return {
        stepNumber: i + 1,
        label: t`${label} failed`,
        tokenSymbol: undefined,
        state: 'failed' as const,
        description: failureDetail ? `${rolledBack} ${failureDetail}` : rolledBack,
        retry: 'trailing' as const
      };
    }

    const state: StepState =
      allDone || (!bundled && i < currentStep)
        ? 'completed'
        : bundled || i === currentStep
          ? 'active'
          : 'upcoming';

    return { stepNumber: i + 1, label, tokenSymbol, state };
  });
}
