import { useCallback, useMemo, type ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { useStakeUrnSelectedRewardContract, useStakeUrnSelectedVoteDelegate, ZERO_ADDRESS } from '@/hooks';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { assignSequentialWrites, stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
import { StakeFlow } from '../lib/constants';
import { needsDelegateUpdate, needsRewardUpdate } from './useStakeCalldata';
import { useStakeEngineLaunch, type StakeEngineContext } from './useStakeEngineLaunch';
import type { StakeLaunchContent } from './useStakeConfirmContent';
import { wadToFloat } from '../lib/stakeUsdNotional';

/**
 * Manage confirm-modal step labels, derived from the calldata set in the manage
 * execution order (repay → free → delegate → lock → borrow), approvals first.
 * This is decision M6: the withdraw+repay mock (`1104:20198`) reuses stale
 * stake-flow labels; B-Q2's own proposal is the calldata-derived decomposition
 * implemented here — flagged for design sign-off on APP-312.
 */
export function buildStakeManageSteps({
  needsSkyAllowance,
  needsUsdsAllowance,
  hasLock,
  hasFree,
  hasWipe,
  hasBorrow,
  hasRewardChange,
  rewardSymbol,
  hasDelegateChange,
  claimSymbols,
  shouldUseBatch = true
}: {
  needsSkyAllowance: boolean;
  needsUsdsAllowance: boolean;
  hasLock: boolean;
  hasFree: boolean;
  hasWipe: boolean;
  hasBorrow: boolean;
  hasRewardChange: boolean;
  /** The staged farm's reward-token symbol, once resolved; labels the Change reward chip. */
  rewardSymbol?: string;
  hasDelegateChange: boolean;
  /** Display symbols for the getReward legs, aligned to the engine's free-before-claim order. */
  claimSymbols?: string[];
  /**
   * False = sequential writes: each approval is its own transaction and every
   * other leg (repay, free, claims, farm/delegate switch, lock, borrow) rides
   * in ONE `multicall` (`useBatchStakeMulticall`), so those rows share a
   * `write` index and move together. Bundled needs no indices.
   */
  shouldUseBatch?: boolean;
}): TransactionStep[] {
  const approvals = (needsSkyAllowance && hasLock ? 1 : 0) + (needsUsdsAllowance && hasWipe ? 1 : 0);
  const steps = [
    // Approval steps only render alongside the action that needs them, so a
    // still-loading allowance can't flash a phantom Approve step (the engine
    // still derives the real approve calls itself).
    needsSkyAllowance &&
      hasLock && { label: t`Approve`, tokenSymbol: 'SKY', failureDetail: stepFailureDetail.approve('SKY') },
    needsUsdsAllowance &&
      hasWipe && { label: t`Approve`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.approve('USDS') },
    hasWipe && { label: t`Repay`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.repay('USDS') },
    hasFree && { label: t`Withdraw`, tokenSymbol: 'SKY', failureDetail: stepFailureDetail.withdraw('SKY') },
    ...(claimSymbols ?? []).map(symbol => ({
      label: t`Claim`,
      tokenSymbol: symbol,
      failureDetail: stepFailureDetail.claim(symbol)
    })),
    hasRewardChange &&
      (rewardSymbol ? { label: t`Change reward`, tokenSymbol: rewardSymbol } : t`Change reward`),
    hasDelegateChange && t`Change delegate`,
    hasLock && { label: t`Stake`, tokenSymbol: 'SKY', failureDetail: stepFailureDetail.stake('SKY') },
    hasBorrow && { label: t`Borrow`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.borrow('USDS') }
  ].filter(Boolean) as TransactionStep[];
  return shouldUseBatch ? steps : assignSequentialWrites(steps, approvals);
}

export interface UseStakeManageLaunchParams {
  urnIndex: bigint;
  urnAddress: `0x${string}` | undefined;
  skyToLock: bigint;
  skyToFree: bigint;
  usdsToBorrow: bigint;
  usdsToWipe: bigint;
  wipeAll: boolean;
  /**
   * EFFECTIVE reward contract: the staged selection, or the urn's current one.
   * Omitted = the urn's current farm passes through so `needsRewardUpdate`
   * never fires (the pre-APP-516 behavior, kept for reward-less callers).
   */
  selectedRewardContract?: `0x${string}`;
  /** EFFECTIVE delegate: the staged selection, or the urn's current one (M12). */
  selectedDelegate: `0x${string}` | undefined;
  /** Form validity — gates the engine's prepare/simulation. */
  enabled: boolean;
  /** Reward contracts to bundle a getReward leg for, e.g. a liquidation-recovery claim. */
  rewardContractsToClaim?: `0x${string}`[];
  /** Display symbols aligned to `rewardContractsToClaim`, for step labels only. */
  claimSymbols?: string[];
  /**
   * Full summary body (the amount heroes over the confirm grid). The sheet is
   * the review (Design QA 2800:91832), so the modal never shows this as a
   * review screen — it is the wallet-screen fallback when no
   * `transactionScreenContent` is passed. Pass a MEMOIZED function to receive
   * the engine's own routing — the grid prices the live Network fee from it,
   * which it cannot do from the caller's render (the calls are this hook's
   * output, the body its input). The body is re-pushed as that routing
   * changes, until the transaction leaves IDLE.
   */
  transactionContent?: StakeLaunchContent;
  /** Compact wallet/status-screen summary; omitted, the full body carries over. */
  transactionScreenContent?: ReactNode;
  onSuccess?: () => void;
}

/**
 * The manage seam (Architecture Proposal §4/§5): the F1 calldata (flow
 * `'manage'`) through `useStakeEngineLaunch`, with this flow's step labels and
 * launch copy. One Confirm stages any combination of repay/withdraw/delegate/
 * stake/borrow — legacy MANAGE multicall semantics.
 *
 * The reward contract defaults to the urn's current one so `needsRewardUpdate`
 * only fires when a caller stages a different farm (APP-516's Change-reward
 * flow); the selectFarm leg then rides the same multicall.
 */
export function useStakeManageLaunch({
  urnIndex,
  urnAddress,
  skyToLock,
  skyToFree,
  usdsToBorrow,
  usdsToWipe,
  wipeAll,
  selectedRewardContract,
  selectedDelegate,
  enabled,
  rewardContractsToClaim,
  claimSymbols,
  transactionContent,
  transactionScreenContent,
  onSuccess
}: UseStakeManageLaunchParams) {
  // The gating baselines (M12): the urn reads also feed the steps/analytics
  // change detection below.
  const { data: urnSelectedRewardContract } = useStakeUrnSelectedRewardContract({
    urn: urnAddress || ZERO_ADDRESS
  });
  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: urnAddress || ZERO_ADDRESS
  });

  const effectiveRewardContract = selectedRewardContract ?? urnSelectedRewardContract;

  const hasLock = skyToLock > 0n;
  const hasFree = skyToFree > 0n;
  const hasWipe = wipeAll || usdsToWipe > 0n;
  const hasBorrow = usdsToBorrow > 0n;
  const hasRewardChange = !!needsRewardUpdate(urnAddress, effectiveRewardContract, urnSelectedRewardContract);
  const hasDelegateChange = !!needsDelegateUpdate(urnAddress, selectedDelegate, urnSelectedVoteDelegate);

  const isDelegateOnly =
    hasDelegateChange && !hasLock && !hasFree && !hasWipe && !hasBorrow && !hasRewardChange;
  const isRewardOnly =
    hasRewardChange && !hasLock && !hasFree && !hasWipe && !hasBorrow && !hasDelegateChange;
  const isBorrowOnly =
    hasBorrow && !hasLock && !hasFree && !hasWipe && !hasDelegateChange && !hasRewardChange;

  const buildSteps = useCallback(
    ({ needsSkyAllowance, needsUsdsAllowance, shouldUseBatch, rewardSymbol }: StakeEngineContext) =>
      buildStakeManageSteps({
        needsSkyAllowance,
        needsUsdsAllowance,
        hasLock,
        hasFree,
        hasWipe,
        hasBorrow,
        hasRewardChange,
        rewardSymbol: hasRewardChange ? rewardSymbol : undefined,
        hasDelegateChange,
        claimSymbols,
        shouldUseBatch
      }),
    [hasLock, hasFree, hasWipe, hasBorrow, hasRewardChange, hasDelegateChange, claimSymbols]
  );

  // The moved legs (lock or free, borrow or wipe; a delegate-only change moves
  // nothing and values at $0).
  const notional = useMemo(
    () => ({
      sky: hasLock ? skyToLock : hasFree ? skyToFree : 0n,
      usds: hasBorrow ? usdsToBorrow : hasWipe ? usdsToWipe : 0n
    }),
    [hasLock, hasFree, hasBorrow, hasWipe, skyToLock, skyToFree, usdsToBorrow, usdsToWipe]
  );

  const engine = useStakeEngineLaunch({
    flow: StakeFlow.MANAGE,
    calldata: {
      urnIndex,
      urnAddress,
      skyToLock,
      skyToFree,
      usdsToWipe,
      wipeAll,
      usdsToBorrow,
      selectedRewardContract: effectiveRewardContract,
      selectedDelegate,
      rewardContractsToClaim,
      restakeSkyRewards: false,
      restakeSkyAmount: 0n
    },
    rewardContract: effectiveRewardContract,
    enabled,
    notional,
    buildSteps,
    describe: ({ shouldUseBatch, rewardSymbol }) => {
      // Legacy stakeData shape (M15): signed amount collapses lock/free, signed
      // borrowAmount collapses borrow/repay; manage carries the urn index.
      const skyAmount = hasLock ? wadToFloat(skyToLock) : hasFree ? -wadToFloat(skyToFree) : undefined;
      const stakeAction = hasLock ? 'stake' : hasFree ? 'unstake' : undefined;
      const borrowAmount = hasBorrow
        ? wadToFloat(usdsToBorrow)
        : hasWipe
          ? -wadToFloat(usdsToWipe)
          : undefined;
      const borrowAction = hasBorrow ? 'borrow' : hasWipe ? 'repay' : undefined;
      return {
        // Confirm-modal titles by staged action set (M7, UX 1104:*).
        title: isDelegateOnly
          ? t`Confirm delegate change`
          : isRewardOnly
            ? t`Confirm reward change`
            : isBorrowOnly
              ? t`Confirm borrow`
              : t`Confirm`,
        // Manage toast copy is not in the UX file — flagged on APP-312 (M16).
        toast: {
          loading: t`Changing position`,
          success: t`Your position is updated!`,
          error: t`Failed to change the position`
        },
        stakeData: {
          module: 'stake',
          assetSymbol: 'SKY',
          borrowSymbol: 'USDS',
          urnIndex: Number(urnIndex),
          selectedRewardContract: effectiveRewardContract,
          selectedRewardSymbol: rewardSymbol,
          isDelegating: hasDelegateChange && !!selectedDelegate && selectedDelegate !== ZERO_ADDRESS,
          isBatchTx: shouldUseBatch,
          ...(skyAmount != null && { amount: skyAmount, stakeAction }),
          ...(borrowAmount != null && { borrowAmount, borrowAction })
        }
      };
    },
    transactionContent,
    transactionScreenContent,
    onSuccess
  });

  return {
    ...engine,
    hasRewardChange,
    hasDelegateChange,
    urnSelectedVoteDelegate
  };
}
