import { useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { useChainId } from 'wagmi';
import { usePrices } from '@/hooks';
import { Button } from '@/components/ui/button';
import { RewardsClaimTable } from '@/modules/portfolio/components/RewardsClaimTable';
import { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { useStakeUrnsClaims, type StakeClaimTarget } from '../hooks/useStakeUrnsClaims';
import { groupClaimsByToken, tokenClaimToReward } from '../lib/stakeClaims';
import { priceOfFromPrices } from '../lib/stakeUsdNotional';
import { StakeClaimModal, type StakeClaimSelection } from './StakeClaimModal';

/**
 * My positions Rewards section (comps 3617:24049, 3617:25250): claimable
 * rewards across the wallet's urns, one row per reward token. With two or more
 * tokens a primary "Claim all" heads the section and the row CTAs step down to
 * secondary. A row claims that token from every urn holding it.
 */
export function StakeRewardsSection({ positions }: { positions?: StakeUserPosition[] }) {
  const chainId = useChainId();
  const [selection, setSelection] = useState<StakeClaimSelection | null>(null);

  // Emptied urns can still hold unclaimed rewards, so they count as targets.
  const targets = useMemo<StakeClaimTarget[]>(
    () =>
      (positions ?? [])
        .filter(position => Boolean(position.urnAddress))
        .map(position => ({ urnIndex: BigInt(position.index), urnAddress: position.urnAddress })),
    [positions]
  );
  const { claims } = useStakeUrnsClaims(targets);
  const { data: prices } = usePrices();

  const groups = useMemo(() => groupClaimsByToken(claims), [claims]);
  const rewards = useMemo(() => {
    const priceOf = priceOfFromPrices(prices);
    return groups.map(group => tokenClaimToReward(group, priceOf, chainId));
  }, [groups, prices, chainId]);

  if (rewards.length === 0) return null;

  const multiple = rewards.length > 1;

  return (
    <section data-testid="stake-rewards-section" className="order-2 flex flex-col gap-5">
      <div className="flex min-h-10 items-center justify-between gap-6">
        <h3 className="text-fgPrimary font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
          <Trans>Rewards</Trans>
        </h3>
        {multiple && (
          <Button
            variant="primary"
            size="m"
            onClick={() => setSelection({ targets })}
            className="shrink-0"
            data-testid="stake-rewards-claim-all"
          >
            <Trans>Claim all</Trans>
          </Button>
        )}
      </div>
      <RewardsClaimTable
        rewards={rewards}
        ctaVariant={multiple ? 'secondary' : 'primary'}
        onClaim={reward => {
          const group = groups.find(g => g.rewardSymbol === reward.id);
          if (!group) return;
          setSelection({
            targets,
            rewardContracts: [...new Set(group.claims.map(claim => claim.contractAddress))]
          });
        }}
        testId="stake-rewards-table"
      />
      {selection && (
        <StakeClaimModal selection={selection} onClose={() => setSelection(null)} closeAfterSuccess />
      )}
    </section>
  );
}
