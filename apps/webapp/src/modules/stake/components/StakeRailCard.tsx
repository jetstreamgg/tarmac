import { Skeleton } from '@/components/ui/skeleton';
import { useStakeUserPositions } from '../hooks/useStakeUserPositions';
import { StakeSummaryCard } from './StakeSummaryCard';
import { StakeEngineCard } from './StakeEngineCard';

/**
 * The stake product page's right-rail card, shared by all three tabs so they
 * show the same rail state: a skeleton while the user's positions load, the
 * "My position" aggregate summary card (hi-fi 486:31830) when the connected
 * user has stake positions, and otherwise the Sky Staking Engine promo card —
 * the flow entry point of the empty state (UX 929:11803). Owns its own
 * `useStakeUserPositions` call so Statistics/About need no data plumbing;
 * TanStack Query dedupes it against the Positions tab's read.
 */
export function StakeRailCard() {
  const { data: positions, isLoading } = useStakeUserPositions();

  if (isLoading) return <Skeleton className="rounded-card h-[420px]" />;
  if ((positions?.length ?? 0) > 0) return <StakeSummaryCard positions={positions} />;
  return <StakeEngineCard />;
}
