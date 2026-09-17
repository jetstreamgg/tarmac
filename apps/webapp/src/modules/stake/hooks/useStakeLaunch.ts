import { useCallback, type ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { useCurrentUrnIndex, ZERO_ADDRESS } from '@/hooks';
import { formatBigInt } from '@/utils';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { assignSequentialWrites, stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
import { StakeFlow } from '../lib/constants';
import { wadToFloat } from '../lib/stakeUsdNotional';
import { useStakeEngineLaunch, type StakeEngineContext } from './useStakeEngineLaunch';
import type { StakeLaunchContent } from './useStakeConfirmContent';

/**
 * Confirm-modal step labels, derived from the calldata set — not from tx count
 * (2 txs may render 4 steps). Decisions recorded on APP-311:
 *  - A-Q3: the delegate selection IS shown as a step (the engine bundles
 *    `selectVoteDelegate` into the multicall; hiding it under-reports actions).
 *  - The `selectFarm` call used to be folded into "Stake SKY" (APP-516); it is
 *    now its own "Select reward" step, like the delegate one — the engine
 *    bundles it as a separate leg (open → lock → draw → selectFarm →
 *    selectVoteDelegate), and the Actions list should mirror the legs it
 *    sends (QA round 2026-09-07). The reward token symbol rides along as the
 *    step's token chip once the farm's token read resolves.
 *  - With bundling OFF the engine (`useBatchStakeMulticall`) sends the SKY
 *    approval as its own write and then ONE `multicall` carrying every leg, so
 *    the rows after the approval share a write index and light up, complete
 *    and fail together — otherwise a reverted multicall retitled "Stake" alone
 *    while the reward/delegate rows sat upcoming, as if their legs never ran.
 *    Bundled, the whole list is one unit and needs no indices.
 */
export function buildStakeOpenSteps({
  needsSkyAllowance,
  hasBorrow,
  hasReward = false,
  rewardSymbol,
  hasDelegate,
  shouldUseBatch = true
}: {
  needsSkyAllowance: boolean;
  hasBorrow: boolean;
  /** A reward farm is selected — the multicall carries a `selectFarm` leg. */
  hasReward?: boolean;
  /** The selected farm's reward-token symbol, once resolved; labels the chip. */
  rewardSymbol?: string;
  hasDelegate: boolean;
  /** False = sequential writes (approval, then one multicall) — rows get `write` indices. */
  shouldUseBatch?: boolean;
}): TransactionStep[] {
  const steps = [
    needsSkyAllowance && {
      label: t`Approve`,
      tokenSymbol: 'SKY',
      failureDetail: stepFailureDetail.approve('SKY')
    },
    { label: t`Stake`, tokenSymbol: 'SKY', failureDetail: stepFailureDetail.stake('SKY') },
    hasBorrow && { label: t`Borrow`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.borrow('USDS') },
    hasReward && (rewardSymbol ? { label: t`Select reward`, tokenSymbol: rewardSymbol } : t`Select reward`),
    hasDelegate && t`Delegate voting power`
  ].filter(Boolean) as TransactionStep[];
  return shouldUseBatch ? steps : assignSequentialWrites(steps, needsSkyAllowance ? 1 : 0);
}

export interface UseStakeLaunchParams {
  skyToLock: bigint;
  usdsToBorrow: bigint;
  selectedRewardContract: `0x${string}` | undefined;
  selectedDelegate: `0x${string}` | undefined;
  /** Form validity — gates the engine's prepare/simulation. */
  enabled: boolean;
  /**
   * Full summary body (the stake/borrow amount heroes per hi-fi 486:33412,
   * over the confirm grid). The takeover is the review (Design QA
   * 2800:91832), so the modal never shows this as a review screen — it is the
   * wallet-screen fallback when no `transactionScreenContent` is passed. Pass
   * a MEMOIZED function to receive the engine's own routing — the grid prices
   * the live Network fee from it, which it cannot do from the caller's render
   * (the calls are this hook's output, the body its input). The body is
   * re-pushed as that routing changes, until the transaction leaves IDLE.
   */
  transactionContent?: StakeLaunchContent;
  /** Compact wallet/status-screen summary; omitted, the full body carries over. */
  transactionScreenContent?: ReactNode;
  /** Refetch positions/history + close the takeover after success. */
  onSuccess?: () => void;
}

/**
 * The open-position seam (Architecture Proposal §5): the F1 calldata (flow
 * `'open'`) through `useStakeEngineLaunch`, with this flow's step labels and
 * launch copy. The launch is `skipReview`: the takeover already served as the
 * review, so the modal opens on the wallet screen and the gate runs at once.
 *
 * Per-step explainer copy (hi-fi shows it under the active step) is NOT
 * implemented: it needs an extension of the frozen transaction contract and
 * tx-orchestration owner sign-off — flagged on APP-311, not improvised.
 */
export function useStakeLaunch({
  skyToLock,
  usdsToBorrow,
  selectedRewardContract,
  selectedDelegate,
  enabled,
  transactionContent,
  transactionScreenContent,
  onSuccess
}: UseStakeLaunchParams) {
  // The urn index a brand-new position will take.
  const { data: currentUrnIndex } = useCurrentUrnIndex();

  const hasBorrow = usdsToBorrow > 0n;
  // Same predicate the calldata builder uses for a NEW urn (`needsRewardUpdate`
  // / `needsDelegateUpdate` with no urn address): a non-zero selection is a leg.
  const hasReward = !!selectedRewardContract && selectedRewardContract !== ZERO_ADDRESS;
  const hasDelegate = !!selectedDelegate && selectedDelegate !== ZERO_ADDRESS;

  const buildSteps = useCallback(
    ({ needsSkyAllowance, shouldUseBatch, rewardSymbol }: StakeEngineContext) =>
      buildStakeOpenSteps({
        needsSkyAllowance,
        hasBorrow,
        hasReward,
        rewardSymbol,
        hasDelegate,
        shouldUseBatch
      }),
    [hasBorrow, hasReward, hasDelegate]
  );

  const engine = useStakeEngineLaunch({
    flow: StakeFlow.OPEN,
    calldata: {
      urnIndex: currentUrnIndex ?? 0n,
      urnAddress: undefined,
      skyToLock,
      skyToFree: 0n,
      usdsToWipe: 0n,
      wipeAll: false,
      usdsToBorrow,
      selectedRewardContract,
      selectedDelegate,
      rewardContractsToClaim: undefined,
      restakeSkyRewards: false,
      restakeSkyAmount: 0n
    },
    rewardContract: selectedRewardContract,
    // The urn-index read must have resolved: calldata built on the 0n fallback
    // targets urn 0 — an existing user's live position. The engine's open()
    // index assertion would revert it in simulation, but don't rely on that.
    enabled: enabled && currentUrnIndex !== undefined,
    notional: { sky: skyToLock, usds: usdsToBorrow },
    buildSteps,
    // Labels + the legacy stakeData analytics shape (useStakeTransactionCallbacks)
    // — event payloads are diffed against the legacy widget's before F7 deletes
    // it. `urnIndex` stays undefined on the open flow (legacy passes activeUrn only).
    describe: ({ shouldUseBatch, rewardSymbol }) => ({
      title: t`Confirm`,
      // Result toasts per UX A.4: borrow path announces the position, the
      // stake-only path announces the staked amount.
      toast: {
        loading: t`Opening position`,
        success: hasBorrow ? t`The position is now open!` : t`${formatBigInt(skyToLock)} SKY staked!`,
        error: t`Failed to open the position`
      },
      stakeData: {
        module: 'stake',
        assetSymbol: 'SKY',
        borrowSymbol: 'USDS',
        urnIndex: undefined,
        selectedRewardContract,
        selectedRewardSymbol: rewardSymbol,
        isDelegating: hasDelegate,
        isBatchTx: shouldUseBatch,
        ...(skyToLock > 0n && { amount: wadToFloat(skyToLock), stakeAction: 'stake' }),
        ...(hasBorrow && { borrowAmount: wadToFloat(usdsToBorrow), borrowAction: 'borrow' })
      }
    }),
    transactionContent,
    transactionScreenContent,
    onSuccess
  });

  return engine;
}
