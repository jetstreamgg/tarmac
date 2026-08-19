import { Trans } from '@lingui/react/macro';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Held slot for a product page's position/supply card while the position read
 * resolves — deciding between the two cards on an unresolved balance flashes
 * the "start supplying" pitch at users who already hold a position.
 */
export function PositionCardSkeleton({ testId = 'position-card-skeleton' }: { testId?: string }) {
  return <Skeleton className="h-72 w-full rounded-2xl" data-testid={testId} />;
}

/**
 * Failed-state stand-in for the same slot: the position read errored, so the
 * skeleton would otherwise pulse forever. Same copy convention as the
 * transactions table's error state.
 */
export function PositionCardError({ testId = 'position-card-error' }: { testId?: string }) {
  return (
    <div
      className="bg-bgSecondary text-fgSecondary font-graphik flex h-72 w-full items-center justify-center rounded-2xl p-5 text-center text-sm"
      data-testid={testId}
    >
      <Trans>Unable to load your position, please try again later.</Trans>
    </div>
  );
}
