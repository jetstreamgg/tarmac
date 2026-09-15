import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import { ZERO_ADDRESS } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction, useEntrySlot } from '@/modules/ui/context/TransactionContext';
import { enginePrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';
import { invalidateStakeQueries } from '../lib/invalidateStakeQueries';
import { useFarmRewardSymbol } from '../hooks/useFarmRewardSymbol';
import { useStakePositionDetail } from '../hooks/useStakePositionDetail';
import { useStakeManageLaunch } from '../hooks/useStakeManageLaunch';
import type { StakeLaunchContentContext } from '../hooks/useStakeConfirmContent';
import { StakeConfirmGrid } from './StakeConfirmGrid';
import { RewardList } from './StakeTakeoverRewardCard';
import { DelegateList } from './StakeTakeoverDelegateCard';

type ChangeKind = 'reward' | 'delegate';

const copy = {
  reward: {
    title: () => t`Change reward token`,
    transactionTitle: () => t`Confirm reward change`
  },
  delegate: {
    title: () => t`Change delegate`,
    transactionTitle: () => t`Confirm delegate change`
  }
};

/**
 * Entry body of the Change reward / Change delegate modals (Figma 3015:61490,
 * 3015:61189): the picker list, portaled into the shared modal's entry slot.
 * Mounted as `backgroundContent` so the manage engine survives a minimize.
 * The "Change" CTA stays disabled until a different item is selected and the
 * engine has prepared, then goes straight to the wallet screen, whose summary
 * is the confirm grid (no in-modal review: the picker already is one).
 */
function StakeChangeSelectionPanel({
  kind,
  urnIndex,
  sessionId
}: {
  kind: ChangeKind;
  urnIndex: number;
  sessionId: string;
}) {
  const { updateModalContent, txStatus } = useTransaction();
  const entrySlot = useEntrySlot();
  const detail = useStakePositionDetail(urnIndex);

  const currentReward =
    detail.rewardContract && detail.rewardContract !== ZERO_ADDRESS ? detail.rewardContract : undefined;
  const currentDelegate =
    detail.voteDelegate && detail.voteDelegate !== ZERO_ADDRESS ? detail.voteDelegate : undefined;
  const current = kind === 'reward' ? currentReward : currentDelegate;

  const [selected, setSelected] = useState<`0x${string}` | undefined>(undefined);
  const changed = !!selected && selected.toLowerCase() !== current?.toLowerCase();

  const onSelectReward = useCallback((address: `0x${string}`) => setSelected(address), []);
  // Delegate rows toggle off on a second click (legacy picker behavior).
  const onSelectDelegate = useCallback(
    (address: `0x${string}`) => setSelected(prev => (prev === address ? undefined : address)),
    []
  );

  const stagedRewardSymbol = useFarmRewardSymbol(kind === 'reward' && changed ? selected : undefined);

  const rewardFrom = useMemo(
    () => (currentReward ? { address: currentReward, symbol: detail.rewardSymbol } : undefined),
    [currentReward, detail.rewardSymbol]
  );
  const rewardTo = useMemo(
    () =>
      kind === 'reward' && changed && selected
        ? { address: selected, symbol: stagedRewardSymbol }
        : undefined,
    [kind, changed, selected, stagedRewardSymbol]
  );
  const delegateTo = kind === 'delegate' && changed ? selected : undefined;

  const vault = detail.vault;
  const collateral = vault?.collateralAmount ?? 0n;
  const debt = vault?.debtValue ?? 0n;

  // Amounts are untouched, so before == after; the grid only moves the
  // reward or delegate row. Deps are scalars/memoized (see the manage sheet).
  const renderConfirmSummary = useCallback(
    ({ calls, legCount }: StakeLaunchContentContext) => (
      <StakeConfirmGrid
        calls={calls}
        legCount={legCount}
        hasPosition
        stakedBefore={collateral}
        stakedAfter={collateral}
        debtBefore={debt}
        debtAfter={debt}
        riskBefore={vault?.riskLevel}
        riskAfter={vault?.riskLevel}
        liquidationBefore={vault?.liquidationPrice}
        liquidationAfter={vault?.liquidationPrice}
        stabilityFee={detail.stabilityFee}
        rewardFrom={rewardFrom}
        rewardTo={rewardTo}
        delegateFrom={currentDelegate}
        delegateTo={delegateTo}
      />
    ),
    [
      collateral,
      debt,
      vault?.riskLevel,
      vault?.liquidationPrice,
      detail.stabilityFee,
      rewardFrom,
      rewardTo,
      currentDelegate,
      delegateTo
    ]
  );

  const { execute, steps, prepared, isLoading, error, usdValue } = useStakeManageLaunch({
    urnIndex: BigInt(urnIndex),
    urnAddress: detail.urnAddress,
    skyToLock: 0n,
    skyToFree: 0n,
    usdsToBorrow: 0n,
    usdsToWipe: 0n,
    wipeAll: false,
    selectedRewardContract: kind === 'reward' && changed ? selected : detail.rewardContract,
    selectedDelegate: kind === 'delegate' && changed ? selected : detail.voteDelegate,
    enabled: changed && !detail.vaultLoading,
    transactionContent: renderConfirmSummary,
    transactionContentAsScreen: true,
    sessionId
  });

  // Steps/analytics are pushed at click time so the wallet screen shows the
  // engine's final routing.
  const onConfirm = useCallback(() => {
    updateModalContent(sessionId, {
      steps,
      analytics: {
        widgetName: 'stake',
        flow: 'manage',
        action: 'multicall',
        data: { module: 'stake', urnIndex, change: kind }
      }
    });
    execute();
  }, [updateModalContent, sessionId, urnIndex, kind, steps, execute]);

  const confirmDisabled = !changed || !prepared || isLoading;
  const errorMessage = enginePrepareErrorMessage(prepared, changed && !isLoading ? error : null);

  useEffect(() => {
    if (txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, {
      entry: { confirmLabel: t`Change`, confirmDisabled, errorMessage },
      onConfirm,
      onRetry: onConfirm,
      usdValue
    });
  }, [updateModalContent, sessionId, txStatus, confirmDisabled, errorMessage, onConfirm, usdValue]);

  const body =
    kind === 'reward' ? (
      <RewardList
        selectedRewardContract={selected ?? currentReward}
        onSelect={onSelectReward}
        keepAddress={currentReward}
        dataTestIdPrefix="stake-manage-reward"
        columns={1}
      />
    ) : (
      <DelegateList
        selectedDelegate={selected ?? currentDelegate}
        onSelect={onSelectDelegate}
        dataTestIdPrefix="stake-manage-delegate"
      />
    );

  return entrySlot ? createPortal(body, entrySlot) : body;
}

/**
 * Launcher shared by the Change reward / Change delegate modals: opens the
 * shared TransactionModal at mount with the picker as its entry, returns to
 * the position-details modal on close, and lands on the positions tab after a
 * successful change (same interlock as the claim modal).
 */
function StakeChangeSelectionModal({
  kind,
  urnIndex,
  onClose
}: {
  kind: ChangeKind;
  urnIndex: number;
  onClose: () => void;
}) {
  const { launch, isModalOpen } = useTransaction();
  const queryClient = useQueryClient();
  const [, setSearchParams] = useAppSearchParams();
  const sessionId = useId();

  const succeededRef = useRef(false);

  const onSuccess = useCallback(() => {
    succeededRef.current = true;
    invalidateStakeQueries(queryClient);
    setSearchParams(
      params => {
        params.delete(QueryParams.Flow);
        params.delete(QueryParams.UrnIndex);
        params.delete(QueryParams.StakeTab);
        params.set(QueryParams.Tab, 'positions');
        return params;
      },
      { replace: true }
    );
  }, [queryClient, setSearchParams]);

  const launchedRef = useRef(false);
  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    launch({
      title: copy[kind].title(),
      usdValue: undefined,
      supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
      // Opened over the details modal, which unmounts in this commit.
      scrimHandoff: true,
      transactionTitle: copy[kind].transactionTitle(),
      toast: {
        loading: t`Changing position`,
        success: t`Your position is updated!`,
        error: t`Failed to change the position`
      },
      sessionId,
      entry: { confirmLabel: t`Change`, confirmDisabled: true },
      backgroundContent: <StakeChangeSelectionPanel kind={kind} urnIndex={urnIndex} sessionId={sessionId} />,
      onConfirm: () => {},
      onSuccess,
      analytics: {
        widgetName: 'stake',
        flow: 'manage',
        action: 'multicall',
        data: { module: 'stake', urnIndex, change: kind }
      }
    });
  }, [launch, sessionId, kind, urnIndex, onSuccess]);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isModalOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current && !succeededRef.current) onClose();
  }, [isModalOpen, onClose]);

  return null;
}

/** Change reward token modal (Figma 3015:61490 / 3015:61530). */
export function StakeChangeRewardModal(props: { urnIndex: number; onClose: () => void }) {
  return <StakeChangeSelectionModal kind="reward" {...props} />;
}

/** Change delegate modal (Figma 3015:61189 / 3015:61269). */
export function StakeChangeDelegateModal(props: { urnIndex: number; onClose: () => void }) {
  return <StakeChangeSelectionModal kind="delegate" {...props} />;
}
