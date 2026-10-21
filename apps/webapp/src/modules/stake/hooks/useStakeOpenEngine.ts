import { useCallback, useMemo } from 'react';
import { useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  useBatchStakeMulticall,
  useCurrentUrnIndex,
  useRewardContractTokens,
  useSkyPrice,
  useStakeSkyAllowance,
  useStakeUsdsAllowance,
  ZERO_ADDRESS
} from '@/hooks';
import { formatBigInt } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { assignSequentialWrites, stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
import { calculateStakeApprovalAmounts, useStakeCalldata } from './useStakeCalldata';
import { toLaunchResult, useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { stakeUsdNotional, wadToFloat } from '../lib/stakeUsdNotional';

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

export interface StakeOpenParams {
  skyToLock: bigint;
  usdsToBorrow: bigint;
  selectedRewardContract: `0x${string}` | undefined;
  selectedDelegate: `0x${string}` | undefined;
  /** Form validity — gates the engine's prepare/simulation. */
  enabled: boolean;
}

/**
 * The open-position seam (Architecture Proposal §5): wires the F1 calldata
 * (`useStakeCalldata`, flow `'open'`) into the unmodified `useBatchStakeMulticall`
 * engine and describes the confirm modal. The page reads it for its own gating;
 * the session's flow runs it again with the transaction callbacks.
 *
 * Allowance decisions stay INSIDE the engine (landmine #1) — the read here only
 * labels the Approve step. Batching follows the legacy widget exactly:
 * `batchEnabled && batchSupported && (needsAllowance || calldata.length > 1)`
 * (`StakeModuleWidget/index.tsx:205`); the open flow's USDS approval leg is
 * always zero, so SKY is the only allowance that can gate.
 */
export function useStakeOpenEngine(
  { skyToLock, usdsToBorrow, selectedRewardContract, selectedDelegate, enabled }: StakeOpenParams,
  txCallbacks?: TxCallbacks
) {
  const { address } = useConnection();
  const { priceString: skyPriceString } = useSkyPrice();

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
  const { data: skyAllowance, mutate: mutateSkyAllowance } = useStakeSkyAllowance();
  const needsSkyAllowance = skyAllowance === undefined || skyAllowance < lockAmount;
  // Nothing to approve on the open flow (`usdsAmount` is 0), but the engine
  // still emits an approve leg while the read is unresolved — mirrored so the
  // leg count below can't disagree with the calls it actually builds.
  const { data: usdsAllowance, mutate: mutateUsdsAllowance } = useStakeUsdsAllowance();
  const needsUsdsAllowance = usdsAllowance === undefined || usdsAllowance < usdsAmount;
  const refetchAllowances = useCallback(() => {
    mutateSkyAllowance();
    mutateUsdsAllowance();
  }, [mutateSkyAllowance, mutateUsdsAllowance]);

  const shouldUseBatch = useShouldUseBatch(needsSkyAllowance || calldata.length > 1);

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

  // Legs the flow sends when bundled, mirroring the engine's own composition
  // (approvals, then one call per calldata entry). NOT `calls.length`: with
  // bundling off the engine collapses the calldata into a single `multicall`,
  // so the calls it hands back describe the current route rather than the
  // flow's shape.
  const legCount = (needsSkyAllowance ? 1 : 0) + (needsUsdsAllowance ? 1 : 0) + calldata.length;

  const hasBorrow = usdsToBorrow > 0n;
  // Same predicate the calldata builder uses for a NEW urn (`needsRewardUpdate`
  // / `needsDelegateUpdate` with no urn address): a non-zero selection is a leg.
  const hasReward = !!selectedRewardContract && selectedRewardContract !== ZERO_ADDRESS;
  const hasDelegate = !!selectedDelegate && selectedDelegate !== ZERO_ADDRESS;

  // Labels the Select reward step's chip, and the legacy stakeData analytics
  // shape (useStakeTransactionCallbacks) — event payloads are diffed against
  // the legacy widget's before F7 deletes it. `urnIndex` stays undefined on
  // the open flow (legacy passes activeUrn only).
  const { data: rewardContractTokens } = useRewardContractTokens(selectedRewardContract);
  const selectedRewardSymbol = rewardContractTokens?.rewardsToken?.symbol;

  const steps = buildStakeOpenSteps({
    needsSkyAllowance,
    hasBorrow,
    hasReward,
    rewardSymbol: selectedRewardSymbol,
    hasDelegate,
    shouldUseBatch
  });

  // Live (not computed at launch) because the takeover runs the enhanced-
  // screening preflight on it while the user is still editing.
  const usdValue = useMemo(
    () => stakeUsdNotional(skyToLock, usdsToBorrow, skyPriceString),
    [skyToLock, usdsToBorrow, skyPriceString]
  );

  // The legacy stakeData analytics shape (useStakeTransactionCallbacks); `urnIndex`
  // stays undefined on the open flow (legacy passes activeUrn only).
  const stakeData: Record<string, unknown> = {
    module: 'stake',
    assetSymbol: 'SKY',
    borrowSymbol: 'USDS',
    urnIndex: undefined,
    selectedRewardContract,
    selectedRewardSymbol,
    isDelegating: hasDelegate,
    isBatchTx: shouldUseBatch,
    ...(skyToLock > 0n && { amount: wadToFloat(skyToLock), stakeAction: 'stake' }),
    ...(hasBorrow && { borrowAmount: wadToFloat(usdsToBorrow), borrowAction: 'borrow' })
  };

  // Result toasts per UX A.4: borrow path announces the position, the stake-only
  // path announces the staked amount.
  const formattedSky = formatBigInt(skyToLock);
  const toast = {
    loading: t`Opening position`,
    success: hasBorrow ? t`The position is now open!` : t`${formattedSky} SKY staked!`,
    error: t`Failed to open the position`
  };

  return {
    /** Live USD notional of the staged position, for the takeover's own preflight. */
    usdValue,
    toast,
    stakeData,
    refetchAllowances,
    reset: engine.reset,
    legCount,
    calldata,
    needsSkyAllowance,
    shouldUseBatch,
    ...toLaunchResult(engine, steps)
  };
}
