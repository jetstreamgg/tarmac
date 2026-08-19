import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import {
  useBatchStakeMulticall,
  useCurrentUrnIndex,
  useIsBatchSupported,
  useRewardContractTokens,
  useStakeSkyAllowance,
  ZERO_ADDRESS
} from '@/hooks';
import { formatBigInt } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
// The legacy msgid generators double as e2e anchors — reused, not forked
// (UI Spec §3). They survive F7 by relocation, not deletion.
import { getStakeSubtitle, getStakeTitle, StakeFlow } from '../lib/constants';
import { TxStatus } from '@/widgets/shared/constants';
import { calculateStakeApprovalAmounts, useStakeCalldata } from './useStakeCalldata';

/**
 * Confirm-modal step labels, derived from the calldata set — not from tx count
 * (2 txs may render 4 steps). Decisions recorded on APP-311:
 *  - A-Q3: the delegate selection IS shown as a step (the engine bundles
 *    `selectVoteDelegate` into the multicall; hiding it under-reports actions).
 *  - The automatic `selectFarm` call is folded into "Stake SKY" — it is a
 *    default the user never chose (A-Q2 pending product), and no confirm design
 *    shows it.
 */
export function buildStakeOpenSteps({
  needsSkyAllowance,
  hasBorrow,
  hasDelegate
}: {
  needsSkyAllowance: boolean;
  hasBorrow: boolean;
  hasDelegate: boolean;
}): TransactionStep[] {
  return [
    needsSkyAllowance && { label: t`Approve`, tokenSymbol: 'SKY' },
    { label: t`Stake`, tokenSymbol: 'SKY' },
    hasBorrow && { label: t`Borrow`, tokenSymbol: 'USDS' },
    hasDelegate && t`Delegate voting power`
  ].filter(Boolean) as TransactionStep[];
}

export interface UseStakeLaunchParams {
  skyToLock: bigint;
  usdsToBorrow: bigint;
  selectedRewardContract: `0x${string}` | undefined;
  selectedDelegate: `0x${string}` | undefined;
  /** Form validity — gates the engine's prepare/simulation. */
  enabled: boolean;
  /** Review-screen body (stake/borrow amount heroes per hi-fi 486:33412). */
  transactionContent?: ReactNode;
  /** Refetch positions/history + close the takeover after success. */
  onSuccess?: () => void;
}

/**
 * The open-position seam (Architecture Proposal §5): wires the F1 calldata
 * (`useStakeCalldata`, flow `'open'`) into the unmodified
 * `useBatchStakeMulticall` engine, spreads the context `txCallbacks`, and
 * describes the confirm modal for `TransactionContext.launch()`.
 *
 * Allowance decisions stay INSIDE the engine (landmine #1) — the read here only
 * labels the Approve step. Batching follows the legacy widget exactly:
 * `batchEnabled && batchSupported && (needsAllowance || calldata.length > 1)`
 * (`StakeModuleWidget/index.tsx:205`); the open flow's USDS approval leg is
 * always zero, so SKY is the only allowance that can gate.
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
  onSuccess
}: UseStakeLaunchParams) {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const { address } = useConnection();

  // The urn index a brand-new position will take.
  const { data: currentUrnIndex } = useCurrentUrnIndex();

  const { calldata } = useStakeCalldata({
    flow: 'open',
    ownerAddress: address ?? ZERO_ADDRESS,
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
    restakeSkyAmount: 0n,
    referralCode: REFERRAL_CODE
  });

  // F1's approval math: for the open flow this is lockAmount = skyToLock,
  // usdsAmount = 0n (no wipe leg) — kept on the shared helper for parity.
  const { lockAmount, usdsAmount } = calculateStakeApprovalAmounts({
    skyToLock,
    restakeSkyRewards: false,
    restakeSkyAmount: 0n,
    isSkyRewardPosition: false,
    usdsToWipe: 0n,
    wipeAll: false
  });

  // READ ONLY — labels the Approve step; the engine derives its own approve call.
  const { data: skyAllowance } = useStakeSkyAllowance();
  const needsSkyAllowance = skyAllowance === undefined || skyAllowance < lockAmount;

  const [batchEnabled] = useBatchToggle();
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported && (needsSkyAllowance || calldata.length > 1);

  const engine = useBatchStakeMulticall({
    calldata,
    skyAmount: lockAmount,
    usdsAmount,
    shouldUseBatch,
    // The urn-index read must have resolved: calldata built on the 0n fallback
    // targets urn 0 — an existing user's live position. The engine's open()
    // index assertion would revert it in simulation, but don't rely on that.
    enabled: enabled && currentUrnIndex !== undefined && calldata.length > 0,
    ...txCallbacks
  });

  // Live execute ref: launch() must never snapshot onConfirm state (landmine #2)
  // — the engine hook re-renders between launch and the user's Confirm click.
  const executeRef = useRef(engine.execute);
  useEffect(() => {
    executeRef.current = engine.execute;
  }, [engine.execute]);

  const hasBorrow = usdsToBorrow > 0n;
  const hasDelegate = !!selectedDelegate && selectedDelegate !== ZERO_ADDRESS;
  const steps = buildStakeOpenSteps({ needsSkyAllowance, hasBorrow, hasDelegate });

  // Legacy stakeData analytics shape (useStakeTransactionCallbacks) — event
  // payloads are diffed against the legacy widget's before F7 deletes it.
  // `urnIndex` stays undefined on the open flow (legacy passes activeUrn only).
  const { data: rewardContractTokens } = useRewardContractTokens(selectedRewardContract);
  const selectedRewardSymbol = rewardContractTokens?.rewardsToken?.symbol;

  const launch = useCallback(() => {
    const formattedSky = formatBigInt(skyToLock);
    const formattedUsds = formatBigInt(usdsToBorrow);

    const stakeData: Record<string, unknown> = {
      module: 'stake',
      assetSymbol: 'SKY',
      borrowSymbol: 'USDS',
      urnIndex: undefined,
      selectedRewardContract,
      selectedRewardSymbol,
      isDelegating: hasDelegate,
      isBatchTx: shouldUseBatch,
      ...(skyToLock > 0n && { amount: Number(formatUnits(skyToLock, 18)), stakeAction: 'stake' }),
      ...(hasBorrow && { borrowAmount: Number(formatUnits(usdsToBorrow, 18)), borrowAction: 'borrow' })
    };

    launchModal({
      // Hi-fi 486:33412: the review screen is titled plain "Confirm".
      title: t`Confirm`,
      transactionTitle: i18n._(getStakeTitle(TxStatus.INITIALIZED, StakeFlow.OPEN)),
      subtitles: {
        loading: i18n._(getStakeSubtitle({ flow: StakeFlow.OPEN, txStatus: TxStatus.LOADING })),
        success: i18n._(
          getStakeSubtitle({
            flow: StakeFlow.OPEN,
            txStatus: TxStatus.SUCCESS,
            collateralToLock: formattedSky,
            borrowAmount: hasBorrow ? formattedUsds : undefined,
            selectedToken: 'SKY'
          })
        ),
        error: i18n._(getStakeSubtitle({ flow: StakeFlow.OPEN, txStatus: TxStatus.ERROR }))
      },
      // Result toasts per UX A.4: borrow path announces the position, the
      // stake-only path announces the staked amount.
      toast: {
        loading: t`Opening position`,
        success: hasBorrow ? t`The position is now open!` : t`${formattedSky} SKY staked!`,
        error: t`Failed to open the position`
      },
      transactionContent,
      steps,
      confirmLabel: t`Confirm`,
      onConfirm: () => executeRef.current(),
      onSuccess,
      analytics: {
        widgetName: 'stake',
        flow: 'open',
        action: 'multicall',
        data: stakeData
      }
    });
  }, [
    launchModal,
    skyToLock,
    usdsToBorrow,
    selectedRewardContract,
    selectedRewardSymbol,
    hasBorrow,
    hasDelegate,
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
    needsSkyAllowance,
    shouldUseBatch,
    prepared: engine.prepared,
    isLoading: engine.isLoading,
    error: engine.error
  };
}
