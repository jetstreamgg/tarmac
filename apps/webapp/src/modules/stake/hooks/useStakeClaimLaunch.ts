import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import {
  useBatchStakeMulticall,
  useIsBatchSupported,
  useRewardContractTokens,
  useStakeSkyAllowance,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  useTransactionFlow,
  ZERO_ADDRESS
} from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { parseStakeId, stakeAdapter } from '@/modules/claim/adapters/stakeAdapter';
import type { ClaimableReward } from '@/modules/claim/types';
// Legacy msgids double as e2e anchors — reused, not forked (UI Spec §3).
import { claimSubtitle, claimTitle } from '../lib/constants';
import { TxStatus } from '@/widgets/shared/constants';
import { calculateStakeApprovalAmounts, useStakeCalldata } from './useStakeCalldata';
import { useStakeUrnClaimables } from './useStakeUrnClaimables';

/**
 * Claim confirm-modal step labels, derived from the selection (UX 1050:23881:
 * `1 Claim SKY → 2 Restake SKY`). A plain claim never needs an approval —
 * nothing is pulled from the owner — so the Approve step only renders on the
 * restake variant (the `lock` leg pulls the claimed SKY back in). The plain
 * variant is exactly the restake variant minus its extra steps (AC).
 */
export function buildStakeClaimSteps({
  needsSkyAllowance,
  claimSymbols,
  restake
}: {
  needsSkyAllowance: boolean;
  claimSymbols: string[];
  restake: boolean;
}): TransactionStep[] {
  return [
    restake && needsSkyAllowance && { label: t`Approve`, tokenSymbol: 'SKY' },
    ...claimSymbols.map(symbol => ({ label: t`Claim`, tokenSymbol: symbol })),
    restake && { label: t`Restake`, tokenSymbol: 'SKY' }
  ].filter(Boolean) as TransactionStep[];
}

export interface UseStakeClaimLaunchParams {
  urnIndex: bigint;
  /** Stake-source rewards selected in the modal (adapter ids carry urn+contract). */
  selected: ClaimableReward[];
  /** Selection non-empty and the modal ready — gates both engines' prepare. */
  enabled: boolean;
  /** Review-screen body (per-token reward amount heroes). */
  transactionContent?: ReactNode;
  onSuccess?: () => void;
}

/**
 * The claim seam (Architecture Proposal §5 claim-flows note): plain Claim runs
 * the selected `getReward` calls through D5's stake claim adapter
 * (`stakeAdapter.useClaimCalls` → `useTransactionFlow`, batch-first like the
 * legacy `useBatchStakeClaimAllRewards`); Claim & Restake runs through the F1
 * calldata seam (`useStakeCalldata` with `rewardContractsToClaim` +
 * `restakeSkyRewards`/`restakeSkyAmount` → the unmodified
 * `useBatchStakeMulticall`), byte-identical to the legacy widget's restake
 * multicall (C3). Both engines stay mounted; `launch(restake)` picks per click.
 *
 * Legacy semantics preserved (C4/C5, flagged open product decision):
 *  - restake locks into the SAME urn whose rewards are claimed;
 *  - non-SKY rewards in the bundle are claimed to the wallet, only SKY re-locks;
 *  - `restakeSkyAmount` = the urn's full claimable SKY balance;
 *  - reward/delegate pass through as the urn's current selections so the seam
 *    emits no select* legs (legacy `ClaimRewardsDropdown.tsx:75-76`);
 *  - claims execute SKY-first (legacy dropdown sort), whatever the click order.
 *
 * PRD Decision 6 asymmetry: the calldata lock term is unguarded while the
 * approval math is gated by `isSkyRewardPosition` — both arrive verbatim via
 * the F1 helpers; do not "fix".
 */
export function useStakeClaimLaunch({
  urnIndex,
  selected,
  enabled,
  transactionContent,
  onSuccess
}: UseStakeClaimLaunchParams) {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const chainId = useChainId();
  const { address } = useConnection();

  const { claimables, urnAddress } = useStakeUrnClaimables(urnIndex);

  const selectedSet = useMemo(
    () => new Set(selected.map(reward => parseStakeId(reward.id).rewardContract.toLowerCase())),
    [selected]
  );
  // Raw balances of the selection in claim-execution (SKY-first) order — feeds
  // the restake calldata order and the analytics amounts.
  const selectedClaims = useMemo(
    () => claimables.filter(claim => selectedSet.has(claim.contractAddress.toLowerCase())),
    [claimables, selectedSet]
  );
  const selectedContracts = useMemo(
    () => selectedClaims.map(claim => claim.contractAddress),
    [selectedClaims]
  );

  // Legacy `activeSkyReward` (context.tsx:256-268): the urn's claimable SKY
  // reward, independent of the selection, drives both restake sizing and the
  // approval guard.
  const skyClaim = claimables.find(claim => claim.rewardSymbol?.toUpperCase?.() === 'SKY');
  const isSkyRewardPosition = !!skyClaim;
  const restakeSkyAmount = skyClaim?.claimBalance ?? 0n;
  const restakeAvailable = selectedClaims.some(claim => claim.rewardSymbol?.toUpperCase?.() === 'SKY');

  // ── Plain claim: D5 adapter calls → the shared transaction flow (C2).
  // Ordered before the restake engine so tests can capture the two flows
  // deterministically.
  const { calls: claimCalls } = stakeAdapter.useClaimCalls(selected, { restake: false });
  const plainFlow = useTransactionFlow({
    calls: claimCalls,
    chainId,
    // Legacy useBatchStakeClaimAllRewards: "Always use batch for this flow".
    shouldUseBatch: true,
    enabled: enabled && claimCalls.length > 0,
    ...txCallbacks
  });

  // ── Claim & Restake: the F1 seam (C3), reward/delegate passed through (C4).
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
    skyToLock: 0n,
    skyToFree: 0n,
    usdsToWipe: 0n,
    wipeAll: false,
    usdsToBorrow: 0n,
    selectedRewardContract: urnSelectedRewardContract,
    selectedDelegate: urnSelectedVoteDelegate,
    rewardContractsToClaim: restakeAvailable ? selectedContracts : undefined,
    restakeSkyRewards: restakeAvailable,
    restakeSkyAmount: restakeAvailable ? restakeSkyAmount : 0n,
    referralCode: REFERRAL_CODE
  });

  const { lockAmount, usdsAmount } = calculateStakeApprovalAmounts({
    skyToLock: 0n,
    restakeSkyRewards: restakeAvailable,
    restakeSkyAmount,
    isSkyRewardPosition,
    usdsToWipe: 0n,
    wipeAll: false
  });

  // READ ONLY — labels the Approve step; the engine derives its own approve.
  const { data: skyAllowance } = useStakeSkyAllowance();
  const needsSkyAllowance = skyAllowance === undefined || skyAllowance < lockAmount;

  // Legacy StakeModuleWidget/index.tsx:205 (the USDS leg is always zero here).
  const [batchEnabled] = useBatchToggle();
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported && (needsSkyAllowance || calldata.length > 1);

  const restakeEngine = useBatchStakeMulticall({
    calldata,
    skyAmount: lockAmount,
    usdsAmount,
    shouldUseBatch,
    enabled: enabled && restakeAvailable && calldata.length > 0,
    ...txCallbacks
  });

  // Live execute refs: launch() must never snapshot onConfirm state.
  const plainExecuteRef = useRef(plainFlow.execute);
  const restakeExecuteRef = useRef(restakeEngine.execute);
  useEffect(() => {
    plainExecuteRef.current = plainFlow.execute;
  }, [plainFlow.execute]);
  useEffect(() => {
    restakeExecuteRef.current = restakeEngine.execute;
  }, [restakeEngine.execute]);

  const claimSymbols = useMemo(() => selectedClaims.map(claim => claim.rewardSymbol), [selectedClaims]);

  const { data: rewardContractTokens } = useRewardContractTokens(
    urnSelectedRewardContract && urnSelectedRewardContract !== ZERO_ADDRESS
      ? urnSelectedRewardContract
      : undefined
  );
  const selectedRewardSymbol = rewardContractTokens?.rewardsToken?.symbol;

  const launch = useCallback(
    (restake: boolean) => {
      // Legacy claimTransactionCallbacks parity (C8): claimedRewards carry the
      // raw claim amounts; the action name encodes count × restake.
      const claimedRewards = selectedClaims
        .filter(claim => claim.claimBalance > 0n)
        .map(claim => ({
          tokenSymbol: claim.rewardSymbol,
          amount: Number(formatUnits(claim.claimBalance, 18)),
          rewardContractAddress: claim.contractAddress
        }));
      const claimAction =
        claimedRewards.length === 0
          ? undefined
          : claimedRewards.length === 1
            ? restake
              ? 'claimAndRestake'
              : 'claim'
            : restake
              ? 'claimAllAndRestake'
              : 'claimAll';

      const stakeData: Record<string, unknown> = {
        module: 'stake',
        assetSymbol: 'SKY',
        borrowSymbol: 'USDS',
        urnIndex: Number(urnIndex),
        selectedRewardContract: urnSelectedRewardContract,
        selectedRewardSymbol,
        isDelegating: false,
        isBatchTx: restake ? shouldUseBatch : true,
        ...(restake &&
          restakeSkyAmount > 0n && {
            restakeSkyAmount: Number(formatUnits(restakeSkyAmount, 18)),
            restakeSkyRewards: true
          }),
        ...(claimAction != null && { claimAction, claimedRewards })
      };

      launchModal({
        title: t`Confirm claim`,
        transactionTitle: i18n._(claimTitle[TxStatus.INITIALIZED]),
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
        transactionContent,
        steps: buildStakeClaimSteps({ needsSkyAllowance, claimSymbols, restake }),
        confirmLabel: t`Confirm`,
        onConfirm: () => (restake ? restakeExecuteRef : plainExecuteRef).current(),
        onSuccess,
        analytics: {
          widgetName: 'stake',
          flow: 'manage',
          action: claimAction ?? 'claim',
          data: stakeData
        }
      });
    },
    [
      launchModal,
      urnIndex,
      selectedClaims,
      claimSymbols,
      needsSkyAllowance,
      restakeSkyAmount,
      shouldUseBatch,
      urnSelectedRewardContract,
      selectedRewardSymbol,
      transactionContent,
      onSuccess
    ]
  );

  return {
    launch,
    restakeAvailable,
    plainPrepared: plainFlow.prepared,
    plainLoading: plainFlow.isLoading,
    restakePrepared: restakeEngine.prepared,
    restakeLoading: restakeEngine.isLoading,
    calldata
  };
}
