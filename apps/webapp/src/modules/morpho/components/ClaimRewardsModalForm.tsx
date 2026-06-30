import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChains } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { useMerklRewards, useMerklClaimRewards, type MerklTokenReward } from '@/hooks';
import { formatUsd } from '@/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Text } from '@/modules/layout/components/Typography';
import { useTransaction, useEntrySlot } from '@/modules/ui/context/TransactionContext';

const NO_VALUE = '–';
// Stable empty ref so `rewards` doesn't change identity every render.
const NO_REWARDS: MerklTokenReward[] = [];

function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Text className="text-textSecondary text-sm">{label}</Text>
      <Text className="text-text text-sm font-medium">{children}</Text>
    </div>
  );
}

/**
 * Editable body for the Merkl "Claim rewards" modal, mounted as the shared modal's
 * `backgroundContent` and portaled into its entry slot (mirrors `SavingsModalForm`).
 * Shows all claimable Merkl rewards:
 *  - one token → a single hero amount (no checkbox);
 *  - several   → a checkbox list (default all selected) for partial per-token claims.
 *
 * The shared modal owns the Claim (confirm) button; this body keeps its
 * `confirmDisabled` + `onConfirm` + wallet-screen summary live via
 * `updateModalContent`. Confirm fires the Merkl distributor claim for the selected
 * subset — calldata is the existing `useMerklClaimRewards` path.
 */
export function ClaimRewardsModalForm({ sessionId }: { sessionId: string }) {
  const { updateModalContent, txCallbacks } = useTransaction();
  const entrySlot = useEntrySlot();
  const chains = useChains();
  const { data, isLoading } = useMerklRewards();
  const rewards = data?.rewards ?? NO_REWARDS;

  // Default to all selected by tracking only explicit *de*selections — so a newly
  // claimable token is selected by default, with no setState-in-effect.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const isSelected = (tokenAddress: string) => !deselected.has(tokenAddress);
  const selectedRewards = useMemo(
    () => rewards.filter(reward => !deselected.has(reward.tokenAddress)),
    [rewards, deselected]
  );

  const claim = useMerklClaimRewards({ rewards: selectedRewards, ...txCallbacks });
  const disabled = selectedRewards.length === 0 || !claim.prepared;

  // `execute` is rebuilt every render; read the latest from a ref so `onConfirm`
  // is stable and never needs re-pushing.
  const executeRef = useRef(claim.execute);
  useEffect(() => {
    executeRef.current = claim.execute;
  }, [claim.execute]);
  const onConfirm = useCallback(() => executeRef.current(), []);

  // Keep the shared modal's confirm gating + handler + wallet-screen summary live.
  useEffect(() => {
    updateModalContent(sessionId, {
      entry: { confirmDisabled: disabled },
      onConfirm,
      transactionScreenContent: (
        <div className="flex flex-col gap-2" data-testid="claim-rewards-summary">
          {selectedRewards.map(reward => (
            <div key={reward.tokenAddress} className="flex items-center gap-2">
              <TokenIcon
                token={{ symbol: reward.tokenSymbol }}
                width={24}
                showChainIcon={false}
                className="h-6 w-6"
              />
              <Text className="text-text text-sm">
                {reward.formattedTotalAmount} {reward.tokenSymbol}
              </Text>
            </div>
          ))}
        </div>
      )
    });
  }, [sessionId, disabled, onConfirm, selectedRewards, updateModalContent]);

  const toggle = (tokenAddress: string) =>
    setDeselected(prev => {
      const next = new Set(prev);
      if (next.has(tokenAddress)) next.delete(tokenAddress);
      else next.add(tokenAddress);
      return next;
    });

  const networkName = rewards[0]
    ? (chains.find(chain => chain.id === rewards[0].distributionChainId)?.name ?? 'Ethereum')
    : 'Ethereum';
  const single = rewards.length === 1;

  const body = (
    <div className="flex flex-col gap-5" data-testid="claim-rewards-form">
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : rewards.length === 0 ? (
        <Text className="text-textSecondary text-sm">
          <Trans>There are currently no claimable rewards.</Trans>
        </Text>
      ) : single ? (
        <div className="flex items-center gap-3" data-testid="claim-reward-row">
          <TokenIcon
            token={{ symbol: rewards[0].tokenSymbol }}
            width={40}
            showChainIcon={false}
            className="h-10 w-10"
          />
          <div className="flex flex-col">
            <span className="text-text text-2xl font-semibold">
              {rewards[0].formattedTotalAmount} {rewards[0].tokenSymbol}
            </span>
            <span className="text-textSecondary text-sm">{formatUsd(rewards[0].totalAmountUsd)}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rewards.map(reward => (
            <label
              key={reward.tokenAddress}
              data-testid="claim-reward-row"
              className="bg-panel flex cursor-pointer items-center gap-3 rounded-xl p-3"
            >
              <Checkbox
                data-testid="claim-reward-checkbox"
                checked={isSelected(reward.tokenAddress)}
                onCheckedChange={() => toggle(reward.tokenAddress)}
                aria-label={reward.tokenSymbol}
              />
              <TokenIcon
                token={{ symbol: reward.tokenSymbol }}
                width={32}
                showChainIcon={false}
                className="h-8 w-8"
              />
              <span className="text-text flex-1 font-medium">{reward.tokenSymbol}</span>
              <div className="flex flex-col items-end">
                <span className="text-text font-medium">{reward.formattedTotalAmount}</span>
                <span className="text-textSecondary text-sm">{formatUsd(reward.totalAmountUsd)}</span>
              </div>
            </label>
          ))}
        </div>
      )}

      {rewards.length > 0 && (
        <div className="border-borderPrimary flex flex-col gap-3 border-t pt-4">
          <InfoRow label={<Trans>Network</Trans>}>{networkName}</InfoRow>
          {/* TODO: live gas estimate; stubbed like the Savings modal. */}
          <InfoRow label={<Trans>Network fee</Trans>}>{NO_VALUE}</InfoRow>
        </div>
      )}
    </div>
  );

  // Display inside the dialog when its entry slot is mounted; otherwise render
  // inline in the hidden host (keeps the body — and its claim hook — mounted).
  return entrySlot ? createPortal(body, entrySlot) : body;
}
