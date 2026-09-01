import type { ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { TxStatus } from '@/widgets/shared/constants';
import type { StepState } from '@/components/ui/steps';

/**
 * One entry of a flow's step list. The plain-string form is a bare label; the
 * object form adds the token rendered as an icon+symbol chip after the label
 * (DS Steps pattern, Figma 5200:30561) — e.g. `{ label: "Approve", tokenSymbol:
 * "SKY" }` renders "Approve ◉ SKY". A step that swaps one token for another
 * (e.g. Convert) also sets `targetTokenSymbol`, rendering a second icon+symbol
 * chip after a translated "to" — "Convert ◉ USDS to ◉ USDC" (Figma step-2 row,
 * two token chips side by side, not stacked).
 */
export type TransactionStep =
  | string
  | {
      label: string;
      tokenSymbol?: string;
      /** Second token for a source→target step; ignored when `tokenSymbol` is unset. */
      targetTokenSymbol?: string;
      /**
       * Flow-specific sentence appended after the generic rollback copy when
       * this step fails — e.g. "The USDS hasn't been approved." (Figma
       * 1030:139111 failure states).
       */
      failureDetail?: string;
      /**
       * 'signature' marks an off-chain pre-flight step (the per-transaction
       * Terms of Use signature, Figma 1868:80848): no hash, no receipt, and it
       * always runs BEFORE the wallet sees a write. That holds in bundled
       * flows too — a signature cannot ride inside an EIP-5792 bundle (the
       * comps draw it bundled, but a wallet can't include an off-chain
       * signature in a batch), so the on-chain steps stay upcoming until the
       * signature completes and only then light up together. Omitted = a
       * normal on-chain write step.
       */
      kind?: 'signature';
      /**
       * Helper paragraph under the label while the step is ACTIVE — the comps
       * draw the review-and-accept copy (with its Terms/Privacy links, hence
       * ReactNode) under the in-progress signature step. Hidden on upcoming
       * and completed rows; a failed row builds its own failure copy instead.
       */
      description?: ReactNode;
    };

export type TransactionStepItem = {
  stepNumber: number;
  label: string;
  tokenSymbol?: string;
  targetTokenSymbol?: string;
  state: StepState;
  /** Grey helper paragraph under the label (active-step copy or failure copy). */
  description?: ReactNode;
  /** Where the "Try again" pill renders: on the failed row, or filling the next step slot (bundled). */
  retry?: 'trailing' | 'slot';
};

type DeriveInput = {
  steps: TransactionStep[];
  currentStep: number;
  txStatus: TxStatus;
  bundled: boolean;
};

const normalize = (step: TransactionStep) => (typeof step === 'string' ? { label: step } : step);
type NormalizedStep = ReturnType<typeof normalize>;

/**
 * Maps a flow's step list + transaction progress to the per-row view state the
 * modal renders (DS Steps pattern). Standard flows advance one step per tx;
 * bundled flows mark every ON-CHAIN step active while the single bundle is in
 * flight, then complete together. Signature steps are the off-chain prelude in
 * both shapes: they advance one-by-one via `currentStep` (the gate drives the
 * same INITIALIZED → onMutate advancement a write does), and until the prelude
 * is done the bundle hasn't started — so its steps render upcoming, not active.
 */
export function deriveTransactionStepItems({
  steps,
  currentStep,
  txStatus,
  bundled
}: DeriveInput): TransactionStepItem[] {
  const allDone = txStatus === TxStatus.SUCCESS;
  const failed = txStatus === TxStatus.ERROR;
  const normalized: NormalizedStep[] = steps.map(normalize);

  // The flow is still in its off-chain prelude while `currentStep` sits on a
  // signature step — nothing has reached the wallet as a write yet.
  const inSignaturePhase = !allDone && normalized[currentStep]?.kind === 'signature';

  // Bundled failure (Figma 1030:139111): the bundle fails as one unit, so the
  // list collapses to a failed summary slot plus a slot holding the retry pill —
  // the flow's own steps reappear once the retry restarts the bundle. Only once
  // the bundle actually started: a failure during the signature prelude renders
  // inline on the signature step below. Signatures already completed survive
  // the failure (they happened off-chain and aren't rolled back), so their rows
  // stay, completed, above the collapsed pair.
  if (failed && bundled && !inSignaturePhase) {
    const prelude: TransactionStepItem[] = normalized
      .slice(0, currentStep)
      .filter(step => step.kind === 'signature')
      .map((step, i) => ({
        stepNumber: i + 1,
        label: step.label,
        tokenSymbol: step.tokenSymbol,
        targetTokenSymbol: step.targetTokenSymbol,
        state: 'completed' as const
      }));
    return [
      ...prelude,
      {
        stepNumber: prelude.length + 1,
        label: t`Transaction failed`,
        tokenSymbol: undefined,
        state: 'failed',
        description: t`The network rolled back your transaction. Try again and confirm bundled transaction in your wallet.`
      },
      {
        stepNumber: prelude.length + 2,
        label: '',
        tokenSymbol: undefined,
        state: 'active',
        retry: 'slot'
      }
    ];
  }

  return normalized.map((step, i) => {
    const { label, tokenSymbol, targetTokenSymbol, failureDetail, kind, description } = step;
    const isSignature = kind === 'signature';

    // Failure on the step the flow stopped on (standard flows, or a bundled
    // flow still in its signature prelude — the bundled on-chain case returned
    // above): the step retitles, carries the failure copy, and the inline
    // retry; earlier steps keep their completions, later ones stay upcoming.
    // A signature has no on-chain rollback, so it gets its own sentence.
    if (failed && i === currentStep) {
      const failure = isSignature
        ? t`The signature request was declined or could not be completed.`
        : t`The network rolled back your transaction.`;
      return {
        stepNumber: i + 1,
        label: t`${label} failed`,
        tokenSymbol: undefined,
        targetTokenSymbol: undefined,
        state: 'failed' as const,
        description: failureDetail ? `${failure} ${failureDetail}` : failure,
        retry: 'trailing' as const
      };
    }

    const state: StepState =
      allDone ||
      // A signature step tracks currentStep in every flow shape; on-chain steps
      // do so only in standard flows (a bundle completes as one unit below).
      ((isSignature || !bundled) && i < currentStep)
        ? 'completed'
        : isSignature || !bundled
          ? i === currentStep
            ? 'active'
            : 'upcoming'
          : // On-chain step of a bundled flow: upcoming until the signature
            // prelude finishes, then the whole bundle is active together.
            inSignaturePhase
            ? 'upcoming'
            : 'active';

    return {
      stepNumber: i + 1,
      label,
      tokenSymbol,
      targetTokenSymbol,
      state,
      description: state === 'active' ? description : undefined
    };
  });
}
