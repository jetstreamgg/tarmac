import { Skeleton } from '@/components/ui/skeleton';

/**
 * Held slot for a product page's position/supply card while the position read
 * resolves — deciding between the two cards on an unresolved balance flashes
 * the "start supplying" pitch at users who already hold a position.
 */
export function PositionCardSkeleton({ testId = 'position-card-skeleton' }: { testId?: string }) {
  return <Skeleton className="h-72 w-full rounded-2xl" data-testid={testId} />;
}
