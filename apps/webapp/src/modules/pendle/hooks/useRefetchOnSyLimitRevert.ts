import { useEffect, useEffectEvent } from 'react';
import { isPendleSyLimitRevert } from '@/lib/revertMessages';

/**
 * Re-reads the SY's limits as soon as a simulation is refused over one: the
 * limit moved since the last read, and the form's own figure should follow now
 * instead of at the next poll.
 */
export function useRefetchOnSyLimitRevert(error: unknown, refetch: () => void) {
  const onLimitRevert = useEffectEvent(refetch);
  useEffect(() => {
    if (isPendleSyLimitRevert(error)) onLimitRevert();
  }, [error]);
}
