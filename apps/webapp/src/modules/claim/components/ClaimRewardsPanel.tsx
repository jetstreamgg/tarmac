import { ReactNode, useMemo, useState } from 'react';
import { useChains, useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { useTransactionFlow } from '@/hooks';
import { formatNumber, getChainIcon } from '@/utils';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { merklAdapter } from '../adapters/merklAdapter';
import { skyRewardsAdapter } from '../adapters/skyRewardsAdapter';
import { stakeAdapter } from '../adapters/stakeAdapter';
import type { ClaimSource, ClaimableReward, ClaimScope } from '../types';

const NO_VALUE = '–';

/**
 * One of the two stacked label/value columns of the modal's footer block
 * (Figma 1036:190131): Body 6 label over a Label 5 value, split by a hairline.
 */
function FooterStat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-fgSecondary font-graphik text-xs leading-[18px]">{label}</span>
      <span className="font-circle text-fgPrimary flex items-center gap-1 text-sm leading-4 font-medium tracking-[-0.28px]">
        {children}
      </span>
    </div>
  );
}

/**
 * The editable body for the generalized "Claim rewards" modal — mounted as the shared
 * modal's `backgroundContent` and portaled into its entry slot (via `useModalEntryBody`).
 *
 * It calls the three claim adapters' read hooks unconditionally (fixed trio,
 * rules-of-hooks), merges their in-scope rewards into one list of amount heroes, and
 * merges every adapter's `Call[]` into ONE `useTransactionFlow` — an EIP-5792 batch on
 * wallets that support it, sequential otherwise. All three engines are mainnet, so a
 * single bundle works. Restake (SKY-only) is offered in the stake scope and passed to
 * the stake adapter, which folds the SKY reward back via `lock`.
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
  const chains = useChains();

  // Fixed trio — called unconditionally, in stable order.
  const merkl = merklAdapter.useClaimable(scope);
  const sky = skyRewardsAdapter.useClaimable(scope);
  const stake = stakeAdapter.useClaimable(scope);

  const isLoading = merkl.isLoading || sky.isLoading || stake.isLoading;
  const rewards = useMemo(
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

  // Each adapter's useClaimCalls filters `rewards` to its own source, so the full list
  // can be passed to all three; only stake reads the restake option.
  const merklCalls = merklAdapter.useClaimCalls(rewards);
  const skyCalls = skyRewardsAdapter.useClaimCalls(rewards);
  const stakeCalls = stakeAdapter.useClaimCalls(rewards, { restake: effectiveRestake });
  const calls = useMemo(
    () => [...merklCalls.calls, ...skyCalls.calls, ...stakeCalls.calls],
    [merklCalls.calls, skyCalls.calls, stakeCalls.calls]
  );

  const flow = useTransactionFlow({ calls, chainId, shouldUseBatch: true, ...txCallbacks });

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
  const hasRewardsIn = (source: ClaimSource) => rewards.some(reward => reward.source === source);
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
      <div className="flex flex-col gap-2" data-testid="claim-rewards-summary">
        {rewards.map(reward => (
          <div key={reward.id} className="flex items-center gap-2">
            {reward.icon}
            <Text className="text-text text-sm">
              {reward.formattedAmount} {reward.tokenSymbol}
            </Text>
          </div>
        ))}
      </div>
    ),
    [rewards]
  );

  const renderInSlot = useModalEntryBody({
    sessionId,
    execute: flow.execute,
    confirmDisabled: disabled,
    transactionScreenContent
  });

  // All three engines are mainnet, so the network is the connected chain.
  const chain = chains.find(candidate => candidate.id === chainId);

  const body = (
    <div className="flex flex-col gap-8" data-testid="claim-rewards-form">
      {isLoading && rewards.length === 0 ? (
        <Skeleton className="h-12 w-full" />
      ) : rewards.length === 0 ? (
        <Text className="text-textSecondary text-sm">
          <Trans>There are currently no claimable rewards.</Trans>
        </Text>
      ) : (
        <div className="flex flex-col gap-8">
          {rewards.map(reward => (
            /* The USD is padded to 2 decimals like the table row's formatUsd — the
               same value must not read "$78.9" here and "$78.90" in the row that
               launched this modal. The hero renders its own `$`, so formatUsd itself
               can't be reused. */
            <TransactionAmountHero
              key={reward.id}
              amount={reward.formattedAmount}
              symbol={reward.tokenSymbol}
              usd={formatNumber(reward.amountUsd, { minDecimals: 2, maxDecimals: 2 })}
              inlineUsd
              dataTestId="claim-reward-row"
            />
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

      {rewards.length > 0 && (
        <div className="flex items-center gap-4">
          {/* TODO: live gas estimate; stubbed like the Savings/Vault modals. */}
          <FooterStat label={<Trans>Network fee</Trans>}>{NO_VALUE}</FooterStat>
          <div className="bg-borderPrimary h-6 w-px shrink-0" />
          <FooterStat label={<Trans>Network</Trans>}>
            {chain ? (
              <>
                {getChainIcon(chain.id, 'h-3 w-3')}
                {chain.name}
              </>
            ) : (
              NO_VALUE
            )}
          </FooterStat>
        </div>
      )}
    </div>
  );

  return renderInSlot(body);
}

// Re-exported for the wallet-screen summary reuse / tests.
export type { ClaimableReward };
