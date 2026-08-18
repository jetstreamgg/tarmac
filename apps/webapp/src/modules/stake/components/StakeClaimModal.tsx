import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useChainId, useChains } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { formatNumber } from '@/utils';
import { TxStatus } from '@/widgets';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useNetworkFee } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { NETWORK_FEE_LABEL, toGridCells } from '@/components/product/ModalGridCells';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { useTransaction, useEntrySlot } from '@/modules/ui/context/TransactionContext';
import { stakeAdapter } from '@/modules/claim/adapters/stakeAdapter';
import type { ClaimableReward } from '@/modules/claim/types';
import { useStakeClaimLaunch } from '../hooks/useStakeClaimLaunch';
import { invalidateStakeQueries } from '../lib/invalidateStakeQueries';
// Legacy msgids double as e2e anchors — reused, not forked (UI Spec §3).
import { claimSubtitle } from '../lib/constants';

const NO_VALUE = '–';

/** SKY first (legacy dropdown sort), stable otherwise — the claim-execution order. */
function sortSkyFirst(rewards: ClaimableReward[]): ClaimableReward[] {
  return [...rewards].sort((a, b) => {
    const aIsSky = a.tokenSymbol.toUpperCase() === 'SKY';
    const bIsSky = b.tokenSymbol.toUpperCase() === 'SKY';

    if (aIsSky && !bIsSky) return -1;
    if (!aIsSky && bIsSky) return 1;
    return 0;
  });
}

/** One reward hero (Figma 1036:213983): 40px icon, Heading-2 amount, USD line, badge. */
function heroFor(reward: ClaimableReward, testIdPrefix: string, label?: boolean) {
  return (
    <TransactionAmountHero
      key={reward.id}
      label={label ? <Trans>Claim amount</Trans> : undefined}
      amount={reward.formattedAmount}
      symbol={reward.tokenSymbol}
      usd={formatNumber(reward.amountUsd, { minDecimals: 2, maxDecimals: 2 })}
      size="lg"
      dataTestId={`${testIdPrefix}-${reward.tokenSymbol.toLowerCase()}`}
    />
  );
}

/**
 * The claim modal's editable body, mounted as the shared modal's
 * `backgroundContent` (so its two engines survive a minimize) and portaled into
 * the entry slot. Renders the reward heroes over [Network fee | Network]
 * (Figma 1036:213978) and keeps the two-CTA footer live: primary
 * `Claim & Restake SKY` + secondary `Claim` while a SKY reward is claimable,
 * a single `Claim` otherwise. The QA comps draw no per-token selection — the
 * flow claims the urn's full claimable set (the old checkbox list is gone,
 * same call as the generalized claim modal).
 */
function StakeClaimPanel({ urnIndex, sessionId }: { urnIndex: number; sessionId: string }) {
  const chainId = useChainId();
  const chains = useChains();
  const { updateModalContent, txStatus } = useTransaction();
  const entrySlot = useEntrySlot();

  const { rewards: unsortedRewards, isLoading } = stakeAdapter.useClaimable({
    kind: 'stake',
    index: BigInt(urnIndex)
  });
  const rewards = useMemo(() => sortSkyFirst(unsortedRewards), [unsortedRewards]);

  const {
    confirm,
    retry,
    restakeAvailable,
    plainPrepared,
    plainLoading,
    restakePrepared,
    restakeLoading,
    calls,
    isBatch
  } = useStakeClaimLaunch({
    urnIndex: BigInt(urnIndex),
    selected: rewards,
    enabled: rewards.length > 0,
    sessionId
  });

  // Read-only: the cell shows a dash until this resolves, and neither CTA waits on it.
  const { data: networkFee, error: networkFeeError } = useNetworkFee({
    calls,
    chainId,
    shouldUseBatch: isBatch
  });

  const bundleState = useBundleFeeState(calls.length, networkFee, !!networkFeeError);

  const claimDisabled = rewards.length === 0 || !plainPrepared || plainLoading;
  const restakeDisabled = rewards.length === 0 || !restakePrepared || restakeLoading;

  const handlePlain = useCallback(() => confirm(false), [confirm]);
  const handleRestake = useCallback(() => confirm(true), [confirm]);

  // Wallet/status screen ("Confirm claim", Figma 1036:214012): the same heroes
  // relabelled "Claim amount", above the Claim/Restake steps.
  const transactionScreenContent = useMemo(
    () => (
      <div className="flex flex-col gap-8" data-testid="stake-claim-summary">
        {rewards.map(reward => heroFor(reward, 'stake-claim-summary', true))}
      </div>
    ),
    [rewards]
  );

  // Keep the entry's CTAs + wallet summary live. While SKY is claimable the
  // primary CTA is the restake bundle and the plain claim rides secondary
  // (comp 1036:214001); without SKY the plain claim is the single primary.
  // Frozen once a CTA fires: the post-claim refetch empties `rewards`, and
  // pushing that state would blank the executed heroes on the wallet/status
  // screens (the convert-modal precedent).
  useEffect(() => {
    if (txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, {
      entry: restakeAvailable
        ? {
            confirmLabel: t`Claim & Restake SKY`,
            confirmDisabled: restakeDisabled,
            secondaryConfirmLabel: t`Claim`,
            secondaryConfirmDisabled: claimDisabled
          }
        : {
            confirmLabel: t`Claim`,
            confirmDisabled: claimDisabled,
            secondaryConfirmLabel: undefined,
            secondaryConfirmDisabled: undefined
          },
      onConfirm: restakeAvailable ? handleRestake : handlePlain,
      onSecondaryConfirm: restakeAvailable ? handlePlain : undefined,
      onRetry: retry,
      transactionScreenContent,
      // USD notional of the claim set (enhanced screening, APP-517) — the
      // restake variant moves the same claimed value, so one number covers
      // both CTAs. Unknown (undefined) while the claimables are resolving.
      usdValue: isLoading ? undefined : rewards.reduce((sum, reward) => sum + reward.amountUsd, 0)
    });
  }, [
    updateModalContent,
    sessionId,
    txStatus,
    restakeAvailable,
    claimDisabled,
    restakeDisabled,
    handlePlain,
    handleRestake,
    retry,
    transactionScreenContent,
    isLoading,
    rewards
  ]);

  const networkName = chains.find(chain => chain.id === chainId)?.name ?? NO_VALUE;

  // [Network fee | Network] (Figma 1036:213990). The fee cell draws the live
  // estimate — the plain claim's, per `useStakeClaimLaunch`'s note on the
  // two-CTA gap — with its tooltip and bundling panel.
  const gridRows = toGridCells(
    [
      [
        { label: NETWORK_FEE_LABEL, kind: 'single', value: networkFee?.formatted ?? NO_VALUE },
        { label: t`Network`, kind: 'single', value: networkName, network: true }
      ]
    ],
    'stake-claim-row',
    { fee: networkFee, state: bundleState }
  );

  const body = (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid="stake-claim-form">
      {isLoading && rewards.length === 0 ? (
        <Skeleton className="h-20 w-full" />
      ) : rewards.length === 0 ? (
        <Text className="text-fgSecondary text-sm leading-5.5">
          <Trans>There are currently no claimable rewards.</Trans>
        </Text>
      ) : (
        <div className="flex flex-col gap-8">
          {rewards.map(reward => heroFor(reward, 'stake-claim-reward'))}
        </div>
      )}

      {rewards.length > 0 && <ModalSummaryGrid rows={gridRows} dividerClassName="h-6" />}

      {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}
    </div>
  );

  // Display inside the dialog when its entry slot is mounted; otherwise render
  // inline in the hidden host (keeps the body — and the engines — mounted).
  return entrySlot ? createPortal(body, entrySlot) : body;
}

/**
 * Claim-rewards modal launcher (Figma 1036:213978 entry → 1036:214007 confirm),
 * on the shared TransactionModal. Launches at mount — the entry body lives in
 * `StakeClaimPanel` above — and returns to the position-details modal (C11)
 * when the shared modal closes; a successful claim clears the manage-flow
 * params and lands on the positions tab (C20) before this ever unmounts.
 */
export function StakeClaimModal({ urnIndex, onClose }: { urnIndex: number; onClose: () => void }) {
  const { launch, isModalOpen } = useTransaction();
  const queryClient = useQueryClient();
  const [, setSearchParams] = useAppSearchParams();
  const sessionId = useId();

  const onSuccess = useCallback(() => {
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
      title: t`Claim rewards`,
      // Figma 1036:214007 titles the wallet screen "Confirm claim".
      transactionTitle: t`Confirm claim`,
      subtitles: {
        loading: i18n._(claimSubtitle[TxStatus.LOADING]),
        success: i18n._(claimSubtitle[TxStatus.SUCCESS]),
        error: i18n._(claimSubtitle[TxStatus.ERROR])
      },
      // Toasts reuse the legacy claim notification copy (C6).
      toast: {
        loading: t`Claiming rewards`,
        success: t`Claim successful`,
        error: t`Claim failed`
      },
      sessionId,
      entry: { confirmLabel: t`Claim`, confirmDisabled: true },
      backgroundContent: <StakeClaimPanel urnIndex={urnIndex} sessionId={sessionId} />,
      onConfirm: () => {},
      onSuccess,
      // The panel pushes the precise claimAction + amounts at confirm time.
      analytics: {
        widgetName: 'stake',
        flow: 'manage',
        action: 'claim',
        data: { module: 'stake', urnIndex }
      }
    });
  }, [launch, sessionId, urnIndex, onSuccess]);

  // Return to the details modal when the shared modal closes. Success never
  // reaches this: it clears the flow params, unmounting this launcher first.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isModalOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) onClose();
  }, [isModalOpen, onClose]);

  return null;
}
