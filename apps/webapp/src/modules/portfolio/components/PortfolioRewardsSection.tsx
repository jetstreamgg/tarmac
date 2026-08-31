import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ClaimableReward } from '@/modules/claim';
import { RewardsClaimTable } from './RewardsClaimTable';

// Each rewards section carries its own top margin rather than leaning on a
// wrapper: both self-hide when empty, and a wrapper would leave a stray gap
// behind a section that renders null. Same 48/80 section rhythm the rest of
// the Portfolio page uses (APP-443 item 5).
const SECTION = 'mt-12 flex flex-col gap-5 md:mt-20';

/**
 * One claimable-rewards section of the Portfolio (Figma 1036:190232 /
 * 1036:190243): a Heading-5 title, an optional "Claim all", and the rewards
 * table.
 *
 * The CTA hierarchy follows the row count: more than one reward puts the
 * primary on the heading's "Claim all" and steps the row buttons down to
 * secondary; a single reward hides "Claim all" and promotes its row button to
 * primary. `canClaimAll` is that same switch from the other side: a section
 * whose claim-all would take more than one transaction (the Sky farms — one
 * `getReward` per farm) passes false while bundling is off, and then renders
 * exactly like a single-reward section.
 *
 * Because the hierarchy flips as the read settles, the loading state renders a
 * skeleton of the same shape — heading row with a button-sized pill plus one
 * table-height bar — so the section doesn't jump. A settled section with no
 * rewards renders nothing.
 */
export function PortfolioRewardsSection({
  title,
  rewards,
  isLoading,
  onClaim,
  onClaimAll,
  canClaimAll = true,
  testId
}: {
  title: ReactNode;
  rewards: ClaimableReward[];
  isLoading: boolean;
  onClaim: (reward: ClaimableReward) => void;
  onClaimAll: () => void;
  /** False where claiming the whole section isn't a single transaction. */
  canClaimAll?: boolean;
  testId: string;
}) {
  if (isLoading && rewards.length === 0) {
    return (
      <section data-testid={`${testId}-skeleton`} className={SECTION}>
        {/* The pill placeholder holds the heading row at its 40px button height
            so the row doesn't grow when a multi-reward "Claim all" arrives. */}
        <div className="flex min-h-10 items-center justify-between gap-6">
          <Heading>{title}</Heading>
          {canClaimAll && (
            <Skeleton
              className="h-10 w-[92px] shrink-0 rounded-full"
              data-testid={`${testId}-claim-all-skeleton`}
            />
          )}
        </div>
        <Skeleton className="h-[122px] w-full rounded-[24px]" />
      </section>
    );
  }

  if (rewards.length === 0) return null;

  const showClaimAll = rewards.length > 1 && canClaimAll;

  return (
    <section data-testid={testId} className={SECTION}>
      <div className="flex min-h-10 items-center justify-between gap-6">
        <Heading>{title}</Heading>
        {showClaimAll && (
          <Button
            variant="primary"
            size="m"
            onClick={onClaimAll}
            className="shrink-0"
            data-testid={`${testId}-claim-all`}
          >
            <Trans>Claim all</Trans>
          </Button>
        )}
      </div>
      <RewardsClaimTable
        rewards={rewards}
        ctaVariant={showClaimAll ? 'secondary' : 'primary'}
        onClaim={onClaim}
        testId={`${testId}-table`}
      />
    </section>
  );
}

/** Heading 5 from md (24/26/-0.48), Heading 6 below — the Earn section-title scale. */
function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-fgPrimary font-circle text-xl leading-[22px] font-medium tracking-[-0.4px] md:text-2xl md:leading-[26px] md:tracking-[-0.48px]">
      {children}
    </h2>
  );
}
