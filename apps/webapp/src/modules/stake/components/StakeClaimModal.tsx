import { ReactNode, useCallback, useMemo, useState } from 'react';
import { useChainId, useChains } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { X } from 'lucide-react';
import { formatUsd } from '@/utils';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { stakeAdapter } from '@/modules/claim/adapters/stakeAdapter';
import type { ClaimableReward } from '@/modules/claim/types';
import { useStakeClaimLaunch } from '../hooks/useStakeClaimLaunch';
import { invalidateStakeQueries } from '../lib/invalidateStakeQueries';

const NO_VALUE = '–';

function InfoRow({
  label,
  dataTestId,
  children
}: {
  label: ReactNode;
  dataTestId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-textSecondary">{label}</span>
      <span className="text-text font-medium" data-testid={dataTestId}>
        {children}
      </span>
    </div>
  );
}

/**
 * Review-screen body: one reward hero per selected token. The UX confirm mock
 * (1050:23881) labels its hero "Stake amount" — flagged mock quirk; the label
 * here follows the C.6 recovery-confirm precedent `Rewards amount (SYM)`.
 */
function StakeClaimConfirmSummary({ selected }: { selected: ClaimableReward[] }) {
  return (
    <div data-testid="stake-claim-confirm-summary" className="flex flex-col gap-5">
      {selected.map(reward => (
        <div
          key={reward.id}
          className="flex flex-col gap-1"
          data-testid={`stake-claim-summary-${reward.tokenSymbol.toLowerCase()}`}
        >
          <span className="text-textSecondary text-sm">
            <Trans>Rewards amount ({reward.tokenSymbol})</Trans>
          </span>
          <span className="text-text flex items-center gap-2 text-2xl font-medium tracking-tight">
            {reward.icon}
            {reward.formattedAmount} {reward.tokenSymbol}
          </span>
          <span className="text-textSecondary text-xs">{formatUsd(reward.amountUsd)}</span>
        </div>
      ))}
    </div>
  );
}

/** SKY first (legacy dropdown sort), stable otherwise — the UX frame order. */
function sortSkyFirst(rewards: ClaimableReward[]): ClaimableReward[] {
  return [...rewards].sort((a, b) => {
    const aIsSky = a.tokenSymbol.toUpperCase() === 'SKY';
    const bIsSky = b.tokenSymbol.toUpperCase() === 'SKY';

    if (aIsSky && !bIsSky) return -1;
    if (!aIsSky && bIsSky) return 1;
    return 0;
  });
}

/**
 * Claim-rewards modal (F6, UX 1050:23669 / 1050:25394 / 1050:25642): per-token
 * checkbox list (all selected by default; a single reward renders as a hero
 * without checkboxes), Network + Network fee rows, and the two-CTA footer —
 * `Claim` plus `Claim & Restake SKY` while SKY is in the selection. Reads come
 * from D5's stake claim adapter; execution goes through `useStakeClaimLaunch`
 * (plain claim = adapter calls, restake = the F1 calldata seam).
 *
 * `onClose` returns to the position-details modal (C11) — the manage-flow
 * params stay staged; a successful claim clears them and lands on the
 * positions tab (C20).
 */
export function StakeClaimModal({ urnIndex, onClose }: { urnIndex: number; onClose: () => void }) {
  const chainId = useChainId();
  const chains = useChains();
  const queryClient = useQueryClient();
  const [, setSearchParams] = useAppSearchParams();

  const { rewards: unsortedRewards, isLoading } = stakeAdapter.useClaimable({
    kind: 'stake',
    index: BigInt(urnIndex)
  });
  const rewards = useMemo(() => sortSkyFirst(unsortedRewards), [unsortedRewards]);

  // Default all selected: track only explicit de-selections (D5 panel pattern),
  // so a late-loading reward arrives selected without a sync effect.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const isSelected = (id: string) => !deselected.has(id);
  const selected = useMemo(() => rewards.filter(reward => isSelected(reward.id)), [rewards, deselected]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setDeselected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const confirmSummary = useMemo(() => <StakeClaimConfirmSummary selected={selected} />, [selected]);

  const { launch, restakeAvailable, plainPrepared, plainLoading, restakePrepared, restakeLoading } =
    useStakeClaimLaunch({
      urnIndex: BigInt(urnIndex),
      selected,
      enabled: selected.length > 0,
      transactionContent: confirmSummary,
      onSuccess
    });

  const claimDisabled = selected.length === 0 || !plainPrepared || plainLoading;
  const restakeDisabled = !restakePrepared || restakeLoading;

  const networkName = chains.find(chain => chain.id === chainId)?.name ?? NO_VALUE;
  const showCheckboxes = rewards.length > 1;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        data-testid="stake-claim-modal"
        className="bg-containerDark flex w-full max-w-md flex-col gap-6 p-6"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="text-text text-lg font-medium">
            <Trans>Claim rewards</Trans>
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t`Close`}
            data-testid="stake-claim-close"
            className="bg-surfaceAlt h-9 w-9 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isLoading && rewards.length === 0 ? (
          <Skeleton className="h-20 w-full" />
        ) : rewards.length === 0 ? (
          <p className="text-textSecondary text-sm">
            <Trans>There are currently no claimable rewards.</Trans>
          </p>
        ) : !showCheckboxes ? (
          <div
            className="text-text flex items-baseline gap-2 text-3xl font-medium tracking-tight"
            data-testid="stake-claim-single"
          >
            <span className="self-center">{rewards[0].icon}</span>
            {rewards[0].formattedAmount} {rewards[0].tokenSymbol}
            <span className="text-textSecondary text-sm font-normal">{formatUsd(rewards[0].amountUsd)}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rewards.map(reward => (
              <label
                key={reward.id}
                data-testid={`stake-claim-row-${reward.tokenSymbol.toLowerCase()}`}
                className="bg-panel flex cursor-pointer items-center gap-3 rounded-xl p-3"
              >
                <Checkbox
                  data-testid={`stake-claim-checkbox-${reward.tokenSymbol.toLowerCase()}`}
                  checked={isSelected(reward.id)}
                  onCheckedChange={() => toggle(reward.id)}
                  aria-label={reward.tokenSymbol}
                />
                {reward.icon}
                <span className="text-text flex-1 font-medium">{reward.tokenSymbol}</span>
                <span className="flex flex-col items-end">
                  <span className="text-text font-medium">{reward.formattedAmount}</span>
                  <span className="text-textSecondary text-sm">{formatUsd(reward.amountUsd)}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="border-textSecondary/10 flex flex-col gap-3 border-t pt-4">
          <InfoRow label={<Trans>Network</Trans>} dataTestId="stake-claim-network">
            {networkName}
          </InfoRow>
          {/* Live gas estimate is stubbed like the D5/Savings/Vault modals (C10). */}
          <InfoRow label={<Trans>Network fee</Trans>} dataTestId="stake-claim-fee">
            {NO_VALUE}
          </InfoRow>
        </div>

        <div className="flex gap-3">
          <Button
            variant={restakeAvailable ? 'secondary' : 'primary'}
            size="xl"
            className="flex-1"
            onClick={() => launch(false)}
            disabled={claimDisabled}
            data-testid="stake-claim-confirm"
          >
            <Trans>Claim</Trans>
          </Button>
          {restakeAvailable && (
            <Button
              variant="primary"
              size="xl"
              className="flex-1"
              onClick={() => launch(true)}
              disabled={restakeDisabled}
              data-testid="stake-claim-restake-confirm"
            >
              <Trans>Claim &amp; Restake SKY</Trans>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
