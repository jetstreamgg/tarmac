import { Skeleton } from '@/components/ui/skeleton';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { StakeSummaryCard } from './StakeSummaryCard';
import { StakeEngineCard } from './StakeEngineCard';

export type StakeRailCardProps = {
  /** The connected user's stake positions, from the page's one query. */
  positions?: StakeUserPosition[];
  isLoading: boolean;
};

/**
 * The stake product page's right-rail card, shared by all three tabs so they
 * show the same rail state: a skeleton while the user's positions load, the
 * "My position" aggregate summary card (hi-fi 486:31830) when the connected
 * user has stake positions, and otherwise the Sky Staking Engine promo card —
 * the flow entry point of the empty state (UX 929:11803). Fed by the page's
 * own `useStakeUserPositions` read rather than a read of its own: the tabs
 * unmount when inactive, and with the default `staleTime` of 0 every remount
 * would refetch the positions (multicalls + the indexer) on each tab switch.
 */
export function StakeRailCard({ positions, isLoading }: StakeRailCardProps) {
  if (isLoading) return <Skeleton className="rounded-card h-[420px]" />;
  if ((positions?.length ?? 0) > 0) return <StakeSummaryCard positions={positions} />;
  return <StakeEngineCard />;
}
