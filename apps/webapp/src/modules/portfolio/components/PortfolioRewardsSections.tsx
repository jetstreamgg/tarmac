import { useCallback } from 'react';
import { Trans } from '@lingui/react/macro';
import {
  merklAdapter,
  skyRewardsAdapter,
  useClaimRewardsModal,
  type ClaimableReward,
  type ClaimScope
} from '@/modules/claim';
import { PortfolioRewardsSection } from './PortfolioRewardsSection';

// Module-level constants: the adapters memoize their reads on the scope
// identity, so a fresh object literal per render would bust the memo (and, via
// the merged-rewards chain, churn every consumer) on every render.
const ECOSYSTEM_SCOPE: ClaimScope = { kind: 'sky-rewards' };
const MERKL_SCOPE: ClaimScope = { kind: 'merkl' };

/**
 * The Portfolio's two claimable-rewards sections, between the position cards
 * and Transactions (Figma 1036:190212 / 1036:189973): "Ecosystem rewards" — the
 * Sky `getReward` farms (SPK / GROVE / CLE, plus the deprecated SKY one while a
 * balance remains) — then "Merkl Rewards", the Morpho-campaign tokens.
 *
 * Staking rewards are deliberately absent: they're per-urn and belong to the
 * Stake page (the stake adapter yields nothing outside a `stake` scope anyway).
 *
 * Each section reads through its claim adapter, so the rows and the modal share
 * one normalized reward model; a row's Claim opens the single-reward scope and
 * "Claim all" the source-wide one. Both sections self-hide when they have
 * nothing to claim.
 */
export function PortfolioRewardsSections() {
  const ecosystem = skyRewardsAdapter.useClaimable(ECOSYSTEM_SCOPE);
  const merkl = merklAdapter.useClaimable(MERKL_SCOPE);

  // Both reads refresh after any claim: a bundled claim-all can span sections,
  // and the cost is two refetches of already-cached queries. Bound to the two
  // `refresh` functions rather than the whole adapter results — those change
  // identity whenever the reward data does, which would churn `refresh` (and
  // `openClaim` with it) for no reason.
  const { refresh: refreshEcosystem } = ecosystem;
  const { refresh: refreshMerkl } = merkl;
  const refresh = useCallback(() => {
    refreshEcosystem();
    refreshMerkl();
  }, [refreshEcosystem, refreshMerkl]);

  const { openClaim } = useClaimRewardsModal({ onSuccess: refresh });

  const claimEcosystem = (reward: ClaimableReward) =>
    openClaim({ kind: 'reward-contract', address: reward.id as `0x${string}` });
  const claimMerkl = (reward: ClaimableReward) =>
    openClaim({ kind: 'merkl-token', tokenAddress: reward.id as `0x${string}` });

  return (
    <>
      <PortfolioRewardsSection
        title={<Trans>Ecosystem rewards</Trans>}
        rewards={ecosystem.rewards}
        isLoading={ecosystem.isLoading}
        onClaim={claimEcosystem}
        onClaimAll={() => openClaim(ECOSYSTEM_SCOPE)}
        testId="portfolio-ecosystem-rewards"
      />
      <PortfolioRewardsSection
        title={<Trans>Merkl Rewards</Trans>}
        rewards={merkl.rewards}
        isLoading={merkl.isLoading}
        onClaim={claimMerkl}
        onClaimAll={() => openClaim(MERKL_SCOPE)}
        testId="portfolio-merkl-rewards"
      />
    </>
  );
}
