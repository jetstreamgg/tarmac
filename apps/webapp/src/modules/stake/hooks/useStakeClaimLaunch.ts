import { useCallback, useEffect, useMemo, useRef } from 'react';
import { formatUnits } from 'viem';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  useBatchStakeMulticall,
  useRewardContractTokens,
  useStakeSkyAllowance,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  useTransactionFlow,
  ZERO_ADDRESS
} from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
import { parseStakeId, stakeAdapter } from '@/modules/claim/adapters/stakeAdapter';
import type { ClaimableReward } from '@/modules/claim/types';
import { calculateStakeApprovalAmounts, useStakeCalldata } from './useStakeCalldata';
import { useStakeUrnClaimables } from './useStakeUrnClaimables';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';

/**
 * Claim confirm-modal step labels, derived from the selection (Figma
 * 1036:214007: `1 Claim ◉ SKY → 2 Restake ◉ SKY`). A plain claim never needs an approval —
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
    restake &&
      needsSkyAllowance && {
        label: t`Approve`,
        tokenSymbol: 'SKY',
        failureDetail: stepFailureDetail.approve('SKY')
      },
    ...claimSymbols.map(symbol => ({
      label: t`Claim`,
      tokenSymbol: symbol,
      failureDetail: stepFailureDetail.claim(symbol)
    })),
    restake && { label: t`Restake`, tokenSymbol: 'SKY', failureDetail: stepFailureDetail.restake('SKY') }
  ].filter(Boolean) as TransactionStep[];
}

export interface UseStakeClaimLaunchParams {
  urnIndex: bigint;
  /** Stake-source rewards the modal claims (adapter ids carry urn+contract). */
  selected: ClaimableReward[];
  /** Selection non-empty and the modal ready — gates both engines' prepare. */
  enabled: boolean;
  /** Session of the already-launched modal — scopes the click-time config pushes. */
  sessionId: string;
}

/**
 * The claim seam (Architecture Proposal §5 claim-flows note): plain Claim runs
 * the selected `getReward` calls through D5's stake claim adapter
 * (`stakeAdapter.useClaimCalls` → `useTransactionFlow`, batch-first like the
 * legacy `useBatchStakeClaimAllRewards`); Claim & Restake runs through the F1
 * calldata seam (`useStakeCalldata` with `rewardContractsToClaim` +
 * `restakeSkyRewards`/`restakeSkyAmount` → the unmodified
 * `useBatchStakeMulticall`), byte-identical to the legacy widget's restake
 * multicall (C3). Both engines stay mounted; `confirm(restake)` picks per click.
 *
 * The modal itself is launched at mount by `StakeClaimModal` (the shared modal's
 * two-CTA entry, Figma 1036:213978); this hook owns the click side: each CTA
 * pushes the clicked mode's steps + analytics into the live config (the provider
 * applies them synchronously, so the engine's onMutate sees them) and fires that
 * mode's engine. `retry` re-fires the last-clicked engine.
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
export function useStakeClaimLaunch({ urnIndex, selected, enabled, sessionId }: UseStakeClaimLaunchParams) {
  const { updateModalContent, txCallbacks } = useTransaction();
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
  const shouldUseBatch = useShouldUseBatch(needsSkyAllowance || calldata.length > 1);

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

  // The last-clicked mode, so a retry after failure re-fires the right engine.
  const restakeModeRef = useRef(false);

  const confirm = useCallback(
    (restake: boolean) => {
      restakeModeRef.current = restake;

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

      // Push the clicked mode's steps + analytics BEFORE executing — the
      // provider applies them to its config ref synchronously, so the engine's
      // onMutate (fired in this same click) tracks the right claimAction.
      updateModalContent(sessionId, {
        steps: buildStakeClaimSteps({ needsSkyAllowance, claimSymbols, restake }),
        analytics: {
          widgetName: 'stake',
          flow: 'manage',
          action: claimAction ?? 'claim',
          data: stakeData
        }
      });
      (restake ? restakeExecuteRef : plainExecuteRef).current();
    },
    [
      updateModalContent,
      sessionId,
      urnIndex,
      selectedClaims,
      claimSymbols,
      needsSkyAllowance,
      restakeSkyAmount,
      shouldUseBatch,
      urnSelectedRewardContract,
      selectedRewardSymbol
    ]
  );

  const retry = useCallback(
    () => (restakeModeRef.current ? restakeExecuteRef : plainExecuteRef).current(),
    []
  );

  return {
    confirm,
    retry,
    restakeAvailable,
    plainPrepared: plainFlow.prepared,
    plainLoading: plainFlow.isLoading,
    restakePrepared: restakeEngine.prepared,
    restakeLoading: restakeEngine.isLoading,
    calldata,
    // The plain-claim flow's calls. The modal draws a single fee row but offers two
    // CTAs (Claim / Claim & Restake); we price the plain claim, which is the one action
    // always available. Restake's extra cost is not represented — a design gap, not an
    // oversight.
    calls: plainFlow.calls ?? [],
    isBatch: !!plainFlow.isBatch
  };
}
