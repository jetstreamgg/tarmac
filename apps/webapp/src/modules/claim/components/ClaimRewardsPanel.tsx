import { useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useAvailableTokenRewardContracts, useTransactionFlow } from '@/hooks';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { formatUsd } from '@/utils';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { NETWORK_FEE_LABEL, toGridCells } from '@/components/product/ModalGridCells';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import type { TransactionAnalytics } from '@/modules/ui/context/transactionContract';
import { TokenBadge } from '@/modules/ui/components/TransactionAmountHero';
import { merklAdapter } from '../adapters/merklAdapter';
import { skyRewardsAdapter } from '../adapters/skyRewardsAdapter';
import { stakeAdapter } from '../adapters/stakeAdapter';
import type { ClaimSource, ClaimableReward, ClaimScope } from '../types';
import { NO_VALUE } from '@/lib/constants';
import { HeroAmount } from '@/components/product/HeroAmount';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';

/**
 * One claimable reward (Figma 1036:190085): 32px token icon, Heading-2 amount
 * with the USD value inline in parens (Body 5, fg-secondary), and the token
 * badge pill right-aligned.
 */
function ClaimRewardRow({ reward }: { reward: ClaimableReward }) {
  return (
    <div className="flex items-center justify-between gap-3" data-testid="claim-reward-row">
      <div className="flex min-w-0 items-center gap-3">
        {reward.icon}
        <div className="flex min-w-0 items-baseline gap-2">
          <HeroAmount amount={reward.formattedAmount} />
          <span className="text-fgSecondary text-sm leading-5.5">({formatUsd(reward.amountUsd)})</span>
        </div>
      </div>
      <TokenBadge symbol={reward.tokenSymbol} />
    </div>
  );
}

/**
 * The body for the generalized "Claim rewards" modal (Figma 1036:190079 single /
 * 1036:190108 stacked) — mounted as the shared modal's `backgroundContent` and
 * portaled into its entry slot (via `useModalEntryBody`).
 *
 * It calls the three claim adapters' read hooks unconditionally (fixed trio,
 * rules-of-hooks), renders every in-scope reward as a hero row, and merges every
 * adapter's `Call[]` into ONE `useTransactionFlow` — an EIP-5792 batch on wallets
 * that support it, sequential otherwise. All three engines are mainnet, so a
 * single bundle works. The redesign claims the full in-scope set — the QA-round
 * comps draw no per-token selection, so the previous checkbox list is gone.
 * Restake (SKY-only) is offered in the stake scope and passed to the stake
 * adapter, which folds the SKY reward back via `lock`.
 *
 * The `scope` narrows what each adapter reads and is the ONLY selection mechanism: a
 * table row's Claim passes a single-reward scope (`merkl-token` / `reward-contract`), a
 * section's Claim all passes the source-wide scope (`merkl` / `sky-rewards`), a vault
 * card passes `{kind:'vault'}`. Per-reward checkboxes were dropped with the redesigned
 * modal (Figma 1036:190105 shows none) — everything in scope is always claimed.
 */
export function ClaimRewardsPanel({ sessionId, scope }: { sessionId: string; scope: ClaimScope }) {
  const { txCallbacks } = useTransaction();
  const chainId = useChainId();

  // Fixed trio — called unconditionally, in stable order (also the merge order).
  const merkl = merklAdapter.useClaimable(scope);
  const sky = skyRewardsAdapter.useClaimable(scope);
  const stake = stakeAdapter.useClaimable(scope);

  const isLoading = merkl.isLoading || sky.isLoading || stake.isLoading;
  const allRewards = useMemo(
    () => [...merkl.rewards, ...sky.rewards, ...stake.rewards],
    [merkl.rewards, sky.rewards, stake.rewards]
  );

  // Restake is a stake-scoped, SKY-only affordance.
  const [restake, setRestake] = useState(false);
  const skyStakeReward =
    scope.kind === 'stake'
      ? stake.rewards.find(reward => reward.tokenSymbol.toUpperCase() === 'SKY')
      : undefined;
  const effectiveRestake = restake && !!skyStakeReward;

  // Each adapter's useClaimCalls filters the list to its own source, so the full
  // list can be passed to all three; only stake reads the restake option.
  const merklCalls = merklAdapter.useClaimCalls(allRewards);
  const skyCalls = skyRewardsAdapter.useClaimCalls(allRewards);
  const stakeCalls = stakeAdapter.useClaimCalls(allRewards, { restake: effectiveRestake });
  const calls = useMemo(
    () => [...merklCalls.calls, ...skyCalls.calls, ...stakeCalls.calls],
    [merklCalls.calls, skyCalls.calls, stakeCalls.calls]
  );

  // Honour the app-wide bundle toggle (and the wallet's support for it), like
  // every module launch hook does — hardcoding `true` here bundled a multi-call
  // claim into one EIP-5792 send even with bundling switched off. With it off
  // the calls go out sequentially instead.
  const shouldUseBatch = useShouldUseBatch();
  const flow = useTransactionFlow({ calls, chainId, shouldUseBatch, ...txCallbacks });

  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const feeCell = useModalFeeCell({ calls, chainId, shouldUseBatch: !!flow.isBatch });

  // Disabled until there's something to send, no in-scope source is still preparing
  // (e.g. Merkl proofs mid-load, so we never claim a partial subset of the scope),
  // AND the flow itself is prepared.
  //
  // That last one matters: the sequential flow's `execute` needs a simulated
  // request and SILENTLY RETURNS (console.log only) without one. Confirming
  // before the simulation lands therefore walks the modal to the wallet screen
  // having dispatched nothing at all — reachable by clicking a row's Claim and
  // the modal CTA straight after a page load. The savings and vault bodies
  // already gate on their engine's `prepared` the same way.
  const hasRewardsIn = (source: ClaimSource) => allRewards.some(reward => reward.source === source);
  const preparing =
    (hasRewardsIn('merkl') && !merklCalls.prepared) ||
    (hasRewardsIn('sky-rewards') && !skyCalls.prepared) ||
    (hasRewardsIn('stake') && !stakeCalls.prepared);
  const disabled = calls.length === 0 || preparing || !flow.prepared;

  // Memoized so the useModalEntryBody sync effect has stable deps — an inline
  // element here recreates every render and loops updateModalContent →
  // setActiveConfig → re-render ("Maximum update depth", crashes the page; the
  // same failure mode the vault form fixed in D4).
  const transactionScreenContent = useMemo(
    () => (
      <div className="flex flex-col gap-8" data-testid="claim-rewards-summary">
        {allRewards.map(reward => (
          <ClaimRewardRow key={reward.id} reward={reward} />
        ))}
      </div>
    ),
    [allRewards]
  );

  // Attribution follows the scope (APP-444 B4/B8): a reward-contract claim reports
  // under the legacy rewards widget, the ecosystem "Claim all" as its claim_all
  // variant, and the Merkl scopes under the vaults widget (module 'morpho'). The
  // stake scope claims through StakeClaimModal (its own confirm-time push) and
  // 'all' has no launcher — neither attributes from here.
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const analytics = useMemo<TransactionAnalytics | undefined>(() => {
    const claimedRewards = allRewards.map(({ tokenSymbol, amount, tokenAddress }) => ({
      tokenSymbol,
      amount,
      tokenAddress
    }));
    switch (scope.kind) {
      case 'reward-contract': {
        const contract = rewardContracts.find(
          c => c.contractAddress?.toLowerCase() === scope.address.toLowerCase()
        );
        return {
          widgetName: 'rewards',
          flow: 'claim',
          action: 'claim',
          data: {
            module: 'rewards',
            product: contract?.name,
            productAddress: contract?.contractAddress,
            assetAddress: contract?.supplyToken.address[chainId],
            assetSymbol: contract?.supplyToken.symbol ?? '',
            isBatchTx: !!flow.isBatch,
            claimedRewards
          }
        };
      }
      case 'sky-rewards':
        return {
          widgetName: 'rewards',
          flow: 'claim',
          action: 'claim_all',
          data: { module: 'rewards', claimedRewards }
        };
      case 'vault':
      case 'merkl':
      case 'merkl-token':
        return {
          widgetName: 'vaults',
          flow: 'claim',
          action: 'claim',
          data: { module: 'morpho', claimedRewards }
        };
      default:
        return undefined;
    }
  }, [scope, allRewards, rewardContracts, chainId, flow.isBatch]);

  // Toast headlines (the launch sets none, so the toast fell back to the
  // success SUBTITLE sentence). A single in-scope reward names its amount —
  // "Claimed 300 SPK"; a stacked claim keeps a generic line, since one
  // headline can't carry several amounts. Memoized: it's a sync-effect dep.
  const toast = useMemo(() => {
    const single = allRewards.length === 1 ? allRewards[0] : undefined;
    return {
      loading: t`Claiming rewards`,
      success: single ? t`Claimed ${single.formattedAmount} ${single.tokenSymbol}` : t`Rewards claimed`,
      error: t`Claim failed`
    };
  }, [allRewards]);

  const renderInSlot = useModalEntryBody({
    sessionId,
    execute: flow.execute,
    confirmDisabled: disabled,
    transactionScreenContent,
    toast,
    // USD notional of the whole claim set for the enhanced-screening
    // threshold (APP-517). Unknown (undefined) while the sources are still
    // resolving — the launch config carries no value either, so the check
    // stays conservative until the amounts land.
    usdValue: isLoading ? undefined : allRewards.reduce((sum, reward) => sum + reward.amountUsd, 0),
    analytics
  });

  // All three engines are mainnet, so the network is the connected chain.
  const networkName = useNetworkName(chainId, NO_VALUE);

  // [Network fee | Network] (Figma 1036:190091). Fee is stubbed like the other modules.
  const gridRows = toGridCells(
    [
      [
        { label: NETWORK_FEE_LABEL, kind: 'single', value: feeCell.fee?.formatted ?? NO_VALUE },
        { label: t`Network`, kind: 'single', value: networkName, network: true }
      ]
    ],
    'claim-modal-row',
    feeCell
  );

  const body = (
    <div className="flex flex-col gap-8 sm:gap-14" data-testid="claim-rewards-form">
      {isLoading && allRewards.length === 0 ? (
        <Skeleton className="h-20 w-full" />
      ) : allRewards.length === 0 ? (
        <Text className="text-fgSecondary text-sm leading-5.5">
          <Trans>There are currently no claimable rewards.</Trans>
        </Text>
      ) : (
        <div className="flex flex-col gap-8">
          {allRewards.map(reward => (
            <ClaimRewardRow key={reward.id} reward={reward} />
          ))}
        </div>
      )}

      {skyStakeReward && (
        <label className="flex items-center justify-between" data-testid="claim-restake-toggle">
          <Text className="text-fgPrimary font-circle text-sm font-medium">
            <Trans>Restake SKY rewards</Trans>
          </Text>
          <Switch checked={effectiveRestake} onCheckedChange={setRestake} aria-label="Restake SKY rewards" />
        </label>
      )}

      {allRewards.length > 0 && <ModalSummaryGrid rows={gridRows} dividerClassName="h-6" />}
    </div>
  );

  return renderInSlot(body);
}

// Re-exported for the wallet-screen summary reuse / tests.
export type { ClaimableReward };
