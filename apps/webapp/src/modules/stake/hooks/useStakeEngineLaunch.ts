import { useCallback, useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useConnection } from 'wagmi';
import {
  useBatchStakeMulticall,
  useRewardContractTokens,
  useSkyPrice,
  useStakeSkyAllowance,
  useStakeUsdsAllowance,
  ZERO_ADDRESS
} from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionConfig } from '@/modules/ui/context/transactionContract';
import { useResetPausedRunOnClose } from '@/modules/ui/hooks/useResetPausedRunOnClose';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { toLaunchResult, useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import type { StakeFlow } from '../lib/constants';
import {
  calculateStakeApprovalAmounts,
  useStakeCalldata,
  type UseStakeCalldataParams
} from './useStakeCalldata';
import { useStakeConfirmContent, type StakeLaunchContent } from './useStakeConfirmContent';
import { launchStakeModal } from './launchStakeModal';
import { stakeUsdNotional } from '../lib/stakeUsdNotional';

/** What the engine resolves that a flow's step labels and analytics depend on. */
export interface StakeEngineContext {
  needsSkyAllowance: boolean;
  needsUsdsAllowance: boolean;
  shouldUseBatch: boolean;
  /** The staged farm's reward-token symbol, once its read resolves. */
  rewardSymbol: string | undefined;
}

export interface UseStakeEngineLaunchParams {
  flow: StakeFlow;
  /** The F1 calldata inputs the flow stages; owner + referral are filled in here. */
  calldata: Omit<UseStakeCalldataParams, 'flow' | 'ownerAddress' | 'referralCode'>;
  /** The farm whose reward token labels the reward step (the staged one, or the urn's). */
  rewardContract: `0x${string}` | undefined;
  /** Form validity — gates the engine's prepare/simulation. */
  enabled: boolean;
  /**
   * The moved legs valued for the enhanced-screening preflight: SKY in/out and
   * USDS in/out. Live, because the takeover/sheet screens while the user edits.
   */
  notional: { sky: bigint; usds: bigint };
  /** The flow's step labels for the engine's current composition. */
  buildSteps: (context: StakeEngineContext) => TransactionStep[];
  /** The flow's half of the launch config, read at click time. */
  describe: (context: StakeEngineContext) => {
    title: string;
    toast: TransactionConfig['toast'];
    /** The legacy stakeData analytics payload (useStakeTransactionCallbacks shape). */
    stakeData: Record<string, unknown>;
  };
  transactionContent?: StakeLaunchContent;
  transactionScreenContent?: ReactNode;
  onSuccess?: () => void;
}

/**
 * The stake engine seam the open and manage flows share: the F1 calldata into
 * the `useBatchStakeMulticall` engine, the approval sizing and the two
 * allowance reads the step labels mirror, the legacy batch condition
 * (`batchEnabled && batchSupported && (needsAllowance || calldata.length > 1)`,
 * `StakeModuleWidget/index.tsx:194-205`), the live review body, the USD
 * notional, and the `skipReview` launch. A flow supplies its calldata inputs,
 * its step labels and the click-time half of the config.
 *
 * Allowance decisions stay INSIDE the engine (landmine #1) — the reads here
 * only label the Approve steps. The USDS approval sizing (wipeAll ×100005/100000
 * buffer) comes from the F1 helper, matching the legacy widget byte-for-byte.
 */
export function useStakeEngineLaunch({
  flow,
  calldata: calldataInputs,
  rewardContract,
  enabled,
  notional,
  buildSteps,
  describe,
  transactionContent,
  transactionScreenContent,
  onSuccess
}: UseStakeEngineLaunchParams) {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const sessionId = useId();
  const { locked, restore } = useMinimizedSessionLock(sessionId);
  const { address } = useConnection();
  const { priceString: skyPriceString } = useSkyPrice();

  const { calldata } = useStakeCalldata({
    flow,
    ownerAddress: address ?? ZERO_ADDRESS,
    referralCode: REFERRAL_CODE,
    ...calldataInputs
  });

  const { lockAmount, usdsAmount } = calculateStakeApprovalAmounts({
    skyToLock: calldataInputs.skyToLock,
    restakeSkyRewards: false,
    restakeSkyAmount: 0n,
    isSkyRewardPosition: false,
    usdsToWipe: calldataInputs.usdsToWipe,
    wipeAll: calldataInputs.wipeAll
  });

  // READ ONLY — label the Approve steps; the engine derives its own approves.
  // The engine emits an approve leg while a read is unresolved, so both are
  // mirrored even where the amount is zero (the open flow's USDS leg).
  const { data: skyAllowance, mutate: mutateSkyAllowance } = useStakeSkyAllowance();
  const { data: usdsAllowance, mutate: mutateUsdsAllowance } = useStakeUsdsAllowance();
  const refetchAllowances = useCallback(() => {
    mutateSkyAllowance();
    mutateUsdsAllowance();
  }, [mutateSkyAllowance, mutateUsdsAllowance]);
  const needsSkyAllowance = skyAllowance === undefined || skyAllowance < lockAmount;
  const needsUsdsAllowance = usdsAllowance === undefined || usdsAllowance < usdsAmount;

  // `calldata` already includes any getReward legs (useStakeCalldata's manage
  // ordering), so a bundled claim counts toward the multi-leg condition.
  const shouldUseBatch = useShouldUseBatch(needsSkyAllowance || needsUsdsAllowance || calldata.length > 1);

  const engine = useBatchStakeMulticall({
    calldata,
    skyAmount: lockAmount,
    usdsAmount,
    shouldUseBatch,
    enabled: enabled && calldata.length > 0,
    ...txCallbacks
  });
  useResetPausedRunOnClose(engine.reset, refetchAllowances);

  // Legs the flow sends when bundled, mirroring the engine's own composition
  // (approvals, then one call per calldata entry). NOT `calls.length`: with
  // bundling off the engine collapses the calldata into a single `multicall`,
  // so the calls it hands back describe the current route rather than the
  // flow's shape.
  const legCount = (needsSkyAllowance ? 1 : 0) + (needsUsdsAllowance ? 1 : 0) + calldata.length;

  // Keeps the review body live while it is still a review, and hands back the
  // stable `onConfirm` over the live engine `execute` (landmine #2: the engine
  // re-renders between launch and the user's Confirm click).
  const { content: confirmContent, onConfirm } = useStakeConfirmContent({
    sessionId,
    execute: engine.execute,
    calls: engine.calls ?? [],
    isBatch: !!engine.isBatch,
    legCount,
    content: transactionContent,
    screenContent: transactionScreenContent
  });

  const { data: rewardContractTokens } = useRewardContractTokens(rewardContract);
  const context: StakeEngineContext = {
    needsSkyAllowance,
    needsUsdsAllowance,
    shouldUseBatch,
    rewardSymbol: rewardContractTokens?.rewardsToken?.symbol
  };

  const steps = buildSteps(context);

  const usdValue = useMemo(
    () => stakeUsdNotional(notional.sky, notional.usds, skyPriceString),
    [notional.sky, notional.usds, skyPriceString]
  );

  // Read at click time through refs, so a flow's inline `describe` never churns
  // the launch callback.
  const describeRef = useRef(describe);
  const contextRef = useRef(context);
  useEffect(() => {
    describeRef.current = describe;
    contextRef.current = context;
  });

  const launch = useCallback(() => {
    launchStakeModal(launchModal, flow, {
      ...describeRef.current(contextRef.current),
      usdValue,
      sessionId,
      transactionContent: confirmContent,
      transactionScreenContent,
      steps,
      onConfirm,
      onSuccess
    });
  }, [
    launchModal,
    flow,
    usdValue,
    sessionId,
    confirmContent,
    transactionScreenContent,
    steps,
    onConfirm,
    onSuccess
  ]);

  return {
    launch,
    locked,
    restore,
    /** Live USD notional of the staged changes, for the surface's own preflight. */
    usdValue,
    calldata,
    needsSkyAllowance,
    needsUsdsAllowance,
    shouldUseBatch,
    rewardSymbol: context.rewardSymbol,
    ...toLaunchResult(engine, steps)
  };
}
