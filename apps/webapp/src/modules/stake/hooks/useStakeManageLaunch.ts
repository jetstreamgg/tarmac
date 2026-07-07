import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import {
  useBatchStakeMulticall,
  useIsBatchSupported,
  useRewardContractTokens,
  useStakeSkyAllowance,
  useStakeUsdsAllowance,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  ZERO_ADDRESS
} from '@/hooks';
import { formatBigInt } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
// Legacy msgid generators double as e2e anchors — reused, not forked (UI Spec §3).
import { getStakeSubtitle, getStakeTitle, StakeFlow } from '@/widgets/StakeModuleWidget/lib/constants';
import { TxStatus } from '@/widgets/shared/constants';
import { calculateStakeApprovalAmounts, needsDelegateUpdate, useStakeCalldata } from './useStakeCalldata';

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
  hasDelegateChange
}: {
  needsSkyAllowance: boolean;
  needsUsdsAllowance: boolean;
  hasLock: boolean;
  hasFree: boolean;
  hasWipe: boolean;
  hasBorrow: boolean;
  hasDelegateChange: boolean;
}): string[] {
  return [
    // Approval steps only render alongside the action that needs them, so a
    // still-loading allowance can't flash a phantom Approve step (the engine
    // still derives the real approve calls itself).
    needsSkyAllowance && hasLock && t`Approve SKY`,
    needsUsdsAllowance && hasWipe && t`Approve USDS`,
    hasWipe && t`Repay USDS`,
    hasFree && t`Withdraw SKY`,
    hasDelegateChange && t`Change delegate`,
    hasLock && t`Stake SKY`,
    hasBorrow && t`Borrow USDS`
  ].filter(Boolean) as string[];
}

export interface UseStakeManageLaunchParams {
  urnIndex: bigint;
  urnAddress: `0x${string}` | undefined;
  skyToLock: bigint;
  skyToFree: bigint;
  usdsToBorrow: bigint;
  usdsToWipe: bigint;
  wipeAll: boolean;
  /** EFFECTIVE delegate: the staged selection, or the urn's current one (M12). */
  selectedDelegate: `0x${string}` | undefined;
  /** Form validity — gates the engine's prepare/simulation. */
  enabled: boolean;
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
 * The reward contract is always passed through as the urn's current one so
 * `needsRewardUpdate` never fires — F5 has no Change-reward flow (M4/M12).
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
  selectedDelegate,
  enabled,
  transactionContent,
  onSuccess
}: UseStakeManageLaunchParams) {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const { address } = useConnection();

  // The gating baselines (M12): reward passes through unchanged; the delegate
  // read also feeds the steps/analytics change detection below.
  const { data: urnSelectedRewardContract } = useStakeUrnSelectedRewardContract({
    urn: urnAddress || ZERO_ADDRESS
  });
  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: urnAddress || ZERO_ADDRESS
  });

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
    selectedRewardContract: urnSelectedRewardContract,
    selectedDelegate,
    rewardContractsToClaim: undefined,
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

  // Legacy StakeModuleWidget/index.tsx:194-205 verbatim (M19).
  const needsAllowance = needsSkyAllowance || needsUsdsAllowance;
  const [batchEnabled] = useBatchToggle();
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported && (needsAllowance || calldata.length > 1);

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
  const hasDelegateChange = !!needsDelegateUpdate(urnAddress, selectedDelegate, urnSelectedVoteDelegate);

  const steps = buildStakeManageSteps({
    needsSkyAllowance,
    needsUsdsAllowance,
    hasLock,
    hasFree,
    hasWipe,
    hasBorrow,
    hasDelegateChange
  });

  const { data: rewardContractTokens } = useRewardContractTokens(urnSelectedRewardContract);
  const selectedRewardSymbol = rewardContractTokens?.rewardsToken?.symbol;

  const isDelegateOnly = hasDelegateChange && !hasLock && !hasFree && !hasWipe && !hasBorrow;
  const isBorrowOnly = hasBorrow && !hasLock && !hasFree && !hasWipe && !hasDelegateChange;

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
      selectedRewardContract: urnSelectedRewardContract,
      selectedRewardSymbol,
      isDelegating: hasDelegateChange && !!selectedDelegate && selectedDelegate !== ZERO_ADDRESS,
      isBatchTx: shouldUseBatch,
      ...(skyAmount != null && { amount: skyAmount, stakeAction }),
      ...(borrowAmount != null && { borrowAmount, borrowAction })
    };

    launchModal({
      // Confirm-modal titles by staged action set (M7, UX 1104:*).
      title: isDelegateOnly ? t`Confirm delegate change` : isBorrowOnly ? t`Confirm borrow` : t`Confirm`,
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
    isBorrowOnly,
    selectedDelegate,
    urnSelectedRewardContract,
    selectedRewardSymbol,
    shouldUseBatch,
    transactionContent,
    steps,
    onSuccess
  ]);

  return {
    launch,
    execute: engine.execute,
    steps,
    calldata,
    hasDelegateChange,
    urnSelectedVoteDelegate,
    shouldUseBatch,
    prepared: engine.prepared,
    isLoading: engine.isLoading,
    error: engine.error
  };
}
