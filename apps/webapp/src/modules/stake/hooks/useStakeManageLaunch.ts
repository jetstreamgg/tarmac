import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import {
  useBatchStakeMulticall,
  useRewardContractTokens,
  useStakeSkyAllowance,
  useStakeUsdsAllowance,
  useSkyPrice,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  ZERO_ADDRESS
} from '@/hooks';
import { formatBigInt } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
// Legacy msgid generators double as e2e anchors — reused, not forked (UI Spec §3).
import { getStakeSubtitle, getStakeTitle, StakeFlow } from '../lib/constants';
import { TxStatus } from '@/widgets/shared/constants';
import {
  calculateStakeApprovalAmounts,
  needsDelegateUpdate,
  needsRewardUpdate,
  useStakeCalldata
} from './useStakeCalldata';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';

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
  hasDelegateChange,
  claimSymbols
}: {
  needsSkyAllowance: boolean;
  needsUsdsAllowance: boolean;
  hasLock: boolean;
  hasFree: boolean;
  hasWipe: boolean;
  hasBorrow: boolean;
  hasRewardChange: boolean;
  hasDelegateChange: boolean;
  /** Display symbols for the getReward legs, aligned to the engine's free-before-claim order. */
  claimSymbols?: string[];
}): TransactionStep[] {
  return [
    // Approval steps only render alongside the action that needs them, so a
    // still-loading allowance can't flash a phantom Approve step (the engine
    // still derives the real approve calls itself).
    needsSkyAllowance && hasLock && { label: t`Approve`, tokenSymbol: 'SKY' },
    needsUsdsAllowance && hasWipe && { label: t`Approve`, tokenSymbol: 'USDS' },
    hasWipe && { label: t`Repay`, tokenSymbol: 'USDS' },
    hasFree && { label: t`Withdraw`, tokenSymbol: 'SKY' },
    ...(claimSymbols ?? []).map(symbol => ({ label: t`Claim`, tokenSymbol: symbol })),
    hasRewardChange && t`Change reward`,
    hasDelegateChange && t`Change delegate`,
    hasLock && { label: t`Stake`, tokenSymbol: 'SKY' },
    hasBorrow && { label: t`Borrow`, tokenSymbol: 'USDS' }
  ].filter(Boolean) as TransactionStep[];
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
  /** Review-screen body (per-action amount heroes / delegate From→To). */
  transactionContent?: ReactNode;
  onSuccess?: () => void;
}

/**
 * The manage seam (Architecture Proposal §4/§5): wires the F1 calldata
 * (`useStakeCalldata`, flow `'manage'`) into the unmodified
 * `useBatchStakeMulticall` engine and describes the confirm modal for
 * `TransactionContext.launch()`. One Confirm stages any combination of
 * repay/withdraw/delegate/stake/borrow — legacy MANAGE multicall semantics.
 *
 * The reward contract defaults to the urn's current one so `needsRewardUpdate`
 * only fires when a caller stages a different farm (APP-516's Change-reward
 * flow); the selectFarm leg then rides the same multicall.
 * Allowance decisions stay INSIDE the engine; the reads here only label steps.
 * The USDS approval sizing (wipeAll ×100005/100000 buffer) comes from the F1
 * helper, matching the legacy widget byte-for-byte.
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
  onSuccess
}: UseStakeManageLaunchParams) {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const { priceString: skyPriceString } = useSkyPrice();
  const { address } = useConnection();

  // The gating baselines (M12): the urn reads also feed the steps/analytics
  // change detection below.
  const { data: urnSelectedRewardContract } = useStakeUrnSelectedRewardContract({
    urn: urnAddress || ZERO_ADDRESS
  });
  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: urnAddress || ZERO_ADDRESS
  });

  const effectiveRewardContract = selectedRewardContract ?? urnSelectedRewardContract;

  const { calldata } = useStakeCalldata({
    flow: 'manage',
    ownerAddress: address ?? ZERO_ADDRESS,
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
    restakeSkyAmount: 0n,
    referralCode: REFERRAL_CODE
  });

  // F1's approval math: lockAmount = skyToLock; usdsAmount = wipe, buffered
  // ×100005/100000 on wipeAll (M11).
  const { lockAmount, usdsAmount } = calculateStakeApprovalAmounts({
    skyToLock,
    restakeSkyRewards: false,
    restakeSkyAmount: 0n,
    isSkyRewardPosition: false,
    usdsToWipe,
    wipeAll
  });

  // READ ONLY — labels the Approve steps; the engine derives its own approves.
  const { data: skyAllowance } = useStakeSkyAllowance();
  const { data: usdsAllowance } = useStakeUsdsAllowance();
  const needsSkyAllowance = skyAllowance === undefined || skyAllowance < lockAmount;
  const needsUsdsAllowance = usdsAllowance === undefined || usdsAllowance < usdsAmount;

  // Legacy StakeModuleWidget/index.tsx:194-205 verbatim (M19). `calldata` already
  // includes any getReward legs (useStakeCalldata's manage ordering), so a
  // bundled claim counts toward the multi-leg batch condition without a
  // separate check here.
  const needsAllowance = needsSkyAllowance || needsUsdsAllowance;
  const shouldUseBatch = useShouldUseBatch(needsAllowance || calldata.length > 1);

  const engine = useBatchStakeMulticall({
    calldata,
    skyAmount: lockAmount,
    usdsAmount,
    shouldUseBatch,
    enabled: enabled && calldata.length > 0,
    ...txCallbacks
  });

  // Live execute ref: launch() must never snapshot onConfirm state.
  const executeRef = useRef(engine.execute);
  useEffect(() => {
    executeRef.current = engine.execute;
  }, [engine.execute]);

  const hasLock = skyToLock > 0n;
  const hasFree = skyToFree > 0n;
  const hasWipe = wipeAll || usdsToWipe > 0n;
  const hasBorrow = usdsToBorrow > 0n;
  const hasRewardChange = !!needsRewardUpdate(urnAddress, effectiveRewardContract, urnSelectedRewardContract);
  const hasDelegateChange = !!needsDelegateUpdate(urnAddress, selectedDelegate, urnSelectedVoteDelegate);

  const steps = buildStakeManageSteps({
    needsSkyAllowance,
    needsUsdsAllowance,
    hasLock,
    hasFree,
    hasWipe,
    hasBorrow,
    hasRewardChange,
    hasDelegateChange,
    claimSymbols
  });

  const { data: rewardContractTokens } = useRewardContractTokens(effectiveRewardContract);
  const selectedRewardSymbol = rewardContractTokens?.rewardsToken?.symbol;

  const isDelegateOnly =
    hasDelegateChange && !hasLock && !hasFree && !hasWipe && !hasBorrow && !hasRewardChange;
  const isRewardOnly =
    hasRewardChange && !hasLock && !hasFree && !hasWipe && !hasBorrow && !hasDelegateChange;
  const isBorrowOnly =
    hasBorrow && !hasLock && !hasFree && !hasWipe && !hasDelegateChange && !hasRewardChange;

  const launch = useCallback(() => {
    const formattedLock = hasLock ? formatBigInt(skyToLock) : undefined;
    const formattedFree = hasFree ? formatBigInt(skyToFree) : undefined;
    const formattedBorrow = hasBorrow ? formatBigInt(usdsToBorrow) : undefined;
    const formattedWipe = hasWipe ? formatBigInt(usdsToWipe) : undefined;

    // Legacy stakeData shape (M15): signed amount collapses lock/free, signed
    // borrowAmount collapses borrow/repay; manage carries the urn index.
    const skyAmount = hasLock
      ? Number(formatUnits(skyToLock, 18))
      : hasFree
        ? -Number(formatUnits(skyToFree, 18))
        : undefined;
    const stakeAction = hasLock ? 'stake' : hasFree ? 'unstake' : undefined;
    const borrowAmount = hasBorrow
      ? Number(formatUnits(usdsToBorrow, 18))
      : hasWipe
        ? -Number(formatUnits(usdsToWipe, 18))
        : undefined;
    const borrowAction = hasBorrow ? 'borrow' : hasWipe ? 'repay' : undefined;

    const stakeData: Record<string, unknown> = {
      module: 'stake',
      assetSymbol: 'SKY',
      borrowSymbol: 'USDS',
      urnIndex: Number(urnIndex),
      selectedRewardContract: effectiveRewardContract,
      selectedRewardSymbol,
      isDelegating: hasDelegateChange && !!selectedDelegate && selectedDelegate !== ZERO_ADDRESS,
      isBatchTx: shouldUseBatch,
      ...(skyAmount != null && { amount: skyAmount, stakeAction }),
      ...(borrowAmount != null && { borrowAmount, borrowAction })
    };

    // USD notional for the enhanced-screening threshold (APP-517): the moved
    // SKY leg at spot plus the moved USDS leg at $1, magnitudes regardless of
    // direction. A non-zero SKY leg with no price available stays
    // `undefined` — unknown, treated as above-threshold. A delegate-only
    // change moves nothing and values at $0.
    const skyLegFloat = hasLock
      ? Number(formatUnits(skyToLock, 18))
      : hasFree
        ? Number(formatUnits(skyToFree, 18))
        : 0;
    const usdsLegFloat = hasBorrow
      ? Number(formatUnits(usdsToBorrow, 18))
      : hasWipe
        ? Number(formatUnits(usdsToWipe, 18))
        : 0;
    const usdValue =
      skyLegFloat === 0
        ? usdsLegFloat
        : skyPriceString
          ? skyLegFloat * parseFloat(skyPriceString) + usdsLegFloat
          : undefined;

    launchModal({
      usdValue,
      // Confirm-modal titles by staged action set (M7, UX 1104:*).
      title: isDelegateOnly
        ? t`Confirm delegate change`
        : isRewardOnly
          ? t`Confirm reward change`
          : isBorrowOnly
            ? t`Confirm borrow`
            : t`Confirm`,
      transactionTitle: i18n._(getStakeTitle(TxStatus.INITIALIZED, StakeFlow.MANAGE)),
      subtitles: {
        loading: i18n._(getStakeSubtitle({ flow: StakeFlow.MANAGE, txStatus: TxStatus.LOADING })),
        success: i18n._(
          getStakeSubtitle({
            flow: StakeFlow.MANAGE,
            txStatus: TxStatus.SUCCESS,
            collateralToLock: formattedLock,
            borrowAmount: formattedBorrow,
            collateralToFree: formattedFree,
            borrowToRepay: formattedWipe,
            selectedToken: 'SKY'
          })
        ),
        error: i18n._(getStakeSubtitle({ flow: StakeFlow.MANAGE, txStatus: TxStatus.ERROR }))
      },
      // Manage toast copy is not in the UX file — flagged on APP-312 (M16).
      toast: {
        loading: t`Changing position`,
        success: t`Your position is updated!`,
        error: t`Failed to change the position`
      },
      transactionContent,
      steps,
      confirmLabel: t`Confirm`,
      onConfirm: () => executeRef.current(),
      onSuccess,
      analytics: {
        widgetName: 'stake',
        flow: 'manage',
        action: 'multicall',
        data: stakeData
      }
    });
  }, [
    launchModal,
    urnIndex,
    skyToLock,
    skyToFree,
    usdsToBorrow,
    usdsToWipe,
    hasLock,
    hasFree,
    hasWipe,
    hasBorrow,
    hasDelegateChange,
    isDelegateOnly,
    isRewardOnly,
    isBorrowOnly,
    selectedDelegate,
    effectiveRewardContract,
    selectedRewardSymbol,
    shouldUseBatch,
    skyPriceString,
    transactionContent,
    steps,
    onSuccess
  ]);

  return {
    launch,
    execute: engine.execute,
    steps,
    calldata,
    hasRewardChange,
    hasDelegateChange,
    urnSelectedVoteDelegate,
    shouldUseBatch,
    prepared: engine.prepared,
    isLoading: engine.isLoading,
    error: engine.error
  };
}
