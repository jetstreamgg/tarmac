import { ReactNode, useMemo, useState } from 'react';
import { useChains, useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { useNetworkFee, useTransactionFlow } from '@/hooks';
import { formatUsd } from '@/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { merklAdapter } from '../adapters/merklAdapter';
import { skyRewardsAdapter } from '../adapters/skyRewardsAdapter';
import { stakeAdapter } from '../adapters/stakeAdapter';
import type { ClaimSource, ClaimableReward, ClaimScope } from '../types';

const NO_VALUE = '–';
// Fixed group order for the merged list (also the order calls are merged in).
const SOURCE_ORDER: ClaimSource[] = ['merkl', 'sky-rewards', 'stake'];

function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Text className="text-textSecondary text-sm">{label}</Text>
      <Text className="text-text text-sm font-medium">{children}</Text>
    </div>
  );
}

/**
 * The editable body for the generalized "Claim rewards" modal — mounted as the shared
 * modal's `backgroundContent` and portaled into its entry slot (via `useModalEntryBody`).
 *
 * It calls the three claim adapters' read hooks unconditionally (fixed trio,
 * rules-of-hooks), merges their in-scope rewards into one grouped, per-token checkbox
 * list (default all selected, tracking only de-selections), and merges every selected
 * adapter's `Call[]` into ONE `useTransactionFlow` — an EIP-5792 batch on wallets that
 * support it, sequential otherwise. All three engines are mainnet, so a single bundle
 * works. Restake (SKY-only) is offered in the stake scope and passed to the stake
 * adapter, which folds the SKY reward back via `lock`.
 *
 * The `scope` narrows what each adapter reads: a vault card passes `{kind:'vault'}`
 * (only Merkl responds), the future portfolio surface passes `{kind:'all'}`, etc.
 */
export function ClaimRewardsPanel({ sessionId, scope }: { sessionId: string; scope: ClaimScope }) {
  const { txCallbacks } = useTransaction();
  const chainId = useChainId();
  const chains = useChains();

  // Fixed trio — called unconditionally, in stable order.
  const merkl = merklAdapter.useClaimable(scope);
  const sky = skyRewardsAdapter.useClaimable(scope);
  const stake = stakeAdapter.useClaimable(scope);

  const isLoading = merkl.isLoading || sky.isLoading || stake.isLoading;
  const allRewards = useMemo(
    () => [...merkl.rewards, ...sky.rewards, ...stake.rewards],
    [merkl.rewards, sky.rewards, stake.rewards]
  );

  // Default all selected: track only explicit de-selections, so a newly loaded reward
  // is selected by default with no setState-in-effect.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const isSelected = (id: string) => !deselected.has(id);
  const selected = useMemo(
    () => allRewards.filter(reward => !deselected.has(reward.id)),
    [allRewards, deselected]
  );

  // Restake is a stake-scoped, SKY-only affordance. Effective only while the SKY reward
  // it folds back is itself selected.
  const [restake, setRestake] = useState(false);
  const skyStakeReward =
    scope.kind === 'stake'
      ? stake.rewards.find(reward => reward.tokenSymbol.toUpperCase() === 'SKY')
      : undefined;
  const effectiveRestake = restake && !!skyStakeReward && isSelected(skyStakeReward.id);

  // Each adapter's useClaimCalls filters `selected` to its own source, so the full list
  // can be passed to all three; only stake reads the restake option.
  const merklCalls = merklAdapter.useClaimCalls(selected);
  const skyCalls = skyRewardsAdapter.useClaimCalls(selected);
  const stakeCalls = stakeAdapter.useClaimCalls(selected, { restake: effectiveRestake });
  const calls = useMemo(
    () => [...merklCalls.calls, ...skyCalls.calls, ...stakeCalls.calls],
    [merklCalls.calls, skyCalls.calls, stakeCalls.calls]
  );

  const flow = useTransactionFlow({ calls, chainId, shouldUseBatch: true, ...txCallbacks });

  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee } = useNetworkFee({ calls, chainId, shouldUseBatch: !!flow.isBatch });

  // Disabled until there's something to send AND no selected source is still preparing
  // (e.g. Merkl proofs mid-load) — so we never claim a partial subset of the selection.
  const hasSelectionIn = (source: ClaimSource) => selected.some(reward => reward.source === source);
  const preparing =
    (hasSelectionIn('merkl') && !merklCalls.prepared) ||
    (hasSelectionIn('sky-rewards') && !skyCalls.prepared) ||
    (hasSelectionIn('stake') && !stakeCalls.prepared);
  const disabled = calls.length === 0 || preparing;

  // Memoized so the useModalEntryBody sync effect has stable deps — an inline
  // element here recreates every render and loops updateModalContent →
  // setActiveConfig → re-render ("Maximum update depth", crashes the page; the
  // same failure mode the vault form fixed in D4).
  const transactionScreenContent = useMemo(
    () => (
      <div className="flex flex-col gap-2" data-testid="claim-rewards-summary">
        {selected.map(reward => (
          <div key={reward.id} className="flex items-center gap-2">
            {reward.icon}
            <Text className="text-text text-sm">
              {reward.formattedAmount} {reward.tokenSymbol}
            </Text>
          </div>
        ))}
      </div>
    ),
    [selected]
  );

  const renderInSlot = useModalEntryBody({
    sessionId,
    execute: flow.execute,
    confirmDisabled: disabled,
    transactionScreenContent
  });

  const toggle = (id: string) =>
    setDeselected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const groups = SOURCE_ORDER.map(source => ({
    source,
    rewards: allRewards.filter(reward => reward.source === source)
  })).filter(group => group.rewards.length > 0);
  const showGroupHeaders = groups.length > 1;
  const showCheckboxes = allRewards.length > 1;

  // All three engines are mainnet, so the network is the connected chain.
  const networkName = chains.find(chain => chain.id === chainId)?.name ?? NO_VALUE;

  const body = (
    <div className="flex flex-col gap-5" data-testid="claim-rewards-form">
      {isLoading && allRewards.length === 0 ? (
        <Skeleton className="h-20 w-full" />
      ) : allRewards.length === 0 ? (
        <Text className="text-textSecondary text-sm">
          <Trans>There are currently no claimable rewards.</Trans>
        </Text>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(group => (
            <div key={group.source} className="flex flex-col gap-2">
              {showGroupHeaders && (
                <div className="flex items-center gap-2" data-testid={`claim-group-${group.source}`}>
                  {group.rewards[0].badge ?? (
                    <Text className="text-textSecondary text-xs font-medium uppercase">
                      {group.rewards[0].sourceLabel}
                    </Text>
                  )}
                </div>
              )}
              {group.rewards.map(reward => (
                <label
                  key={reward.id}
                  data-testid="claim-reward-row"
                  className="bg-panel flex cursor-pointer items-center gap-3 rounded-xl p-3"
                >
                  {showCheckboxes && (
                    <Checkbox
                      data-testid="claim-reward-checkbox"
                      checked={isSelected(reward.id)}
                      onCheckedChange={() => toggle(reward.id)}
                      aria-label={reward.tokenSymbol}
                    />
                  )}
                  {reward.icon}
                  <span className="text-text flex-1 font-medium">{reward.tokenSymbol}</span>
                  <div className="flex flex-col items-end">
                    <span className="text-text font-medium">{reward.formattedAmount}</span>
                    <span className="text-textSecondary text-sm">{formatUsd(reward.amountUsd)}</span>
                  </div>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {skyStakeReward && (
        <label className="flex items-center justify-between" data-testid="claim-restake-toggle">
          <Text className="text-text text-sm font-medium">
            <Trans>Restake SKY rewards</Trans>
          </Text>
          <Switch checked={effectiveRestake} onCheckedChange={setRestake} aria-label="Restake SKY rewards" />
        </label>
      )}

      {allRewards.length > 0 && (
        <div className="border-borderPrimary flex flex-col gap-3 border-t pt-4">
          <InfoRow label={<Trans>Network</Trans>}>{networkName}</InfoRow>
          <InfoRow label={<Trans>Network fee</Trans>}>{networkFee?.formatted ?? NO_VALUE}</InfoRow>
        </div>
      )}
    </div>
  );

  return renderInSlot(body);
}

// Re-exported for the wallet-screen summary reuse / tests.
export type { ClaimableReward };
