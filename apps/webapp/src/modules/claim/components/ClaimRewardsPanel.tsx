import { useMemo, useState } from 'react';
import { useChains, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useTransactionFlow } from '@/hooks';
import { formatUsd } from '@/utils';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { TokenBadge } from '@/modules/ui/components/TransactionAmountHero';
import { merklAdapter } from '../adapters/merklAdapter';
import { skyRewardsAdapter } from '../adapters/skyRewardsAdapter';
import { stakeAdapter } from '../adapters/stakeAdapter';
import type { ClaimSource, ClaimableReward, ClaimScope } from '../types';

const NO_VALUE = '–';

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
          <span className="font-circle text-fgPrimary truncate text-[44px] leading-12 font-medium tracking-[-0.88px]">
            {reward.formattedAmount}
          </span>
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
 * The `scope` narrows what each adapter reads: a vault card passes `{kind:'vault'}`
 * (only Merkl responds), the future portfolio surface passes `{kind:'all'}`, etc.
 */
export function ClaimRewardsPanel({ sessionId, scope }: { sessionId: string; scope: ClaimScope }) {
  const { txCallbacks } = useTransaction();
  const chainId = useChainId();
  const chains = useChains();

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

  const flow = useTransactionFlow({ calls, chainId, shouldUseBatch: true, ...txCallbacks });

  // Disabled until there's something to send AND no in-scope source is still
  // preparing (e.g. Merkl proofs mid-load) — so we never claim a partial subset.
  const hasRewardsIn = (source: ClaimSource) => allRewards.some(reward => reward.source === source);
  const preparing =
    (hasRewardsIn('merkl') && !merklCalls.prepared) ||
    (hasRewardsIn('sky-rewards') && !skyCalls.prepared) ||
    (hasRewardsIn('stake') && !stakeCalls.prepared);
  const disabled = calls.length === 0 || preparing;

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

  const renderInSlot = useModalEntryBody({
    sessionId,
    execute: flow.execute,
    confirmDisabled: disabled,
    transactionScreenContent
  });

  // All three engines are mainnet, so the network is the connected chain.
  const networkName = chains.find(chain => chain.id === chainId)?.name ?? NO_VALUE;

  // [Network fee | Network] (Figma 1036:190091). Fee is stubbed like the other modules.
  const gridRows = toGridCells(
    [
      [
        { label: t`Network fee`, kind: 'single', value: NO_VALUE },
        { label: t`Network`, kind: 'single', value: networkName, network: true }
      ]
    ],
    'claim-modal-row'
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
          <Text className="text-fgPrimary text-sm font-medium">
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
