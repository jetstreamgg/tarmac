import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { useBridgeLaunch } from './useBridgeLaunch';
import { useCctpResumeForm } from './useCctpResumeForm';

/**
 * Continues unfinished CCTP swaps from their cards, one launch for all of them
 * (as `useDestinationActionLaunch` hosts the cards' actions). A card goes once
 * its burn is sent; the swap is kept until that burn mines.
 */
export function useCctpResumeLaunch() {
  // A new object per click, so the same card can be launched again.
  const [request, setRequest] = useState<{ swap: UnfinishedCctpSwap }>();
  const swap = request?.swap;
  const { form } = useCctpResumeForm(swap);
  const clear = useCallback(() => setRequest(undefined), []);
  const { launch: open } = useBridgeLaunch(form, clear, swap);
  // Opened after the render that builds the swap's form, once per click.
  const openedRef = useRef<typeof request>(undefined);
  useEffect(() => {
    if (!request || openedRef.current === request) return;
    openedRef.current = request;
    open();
  }, [request, open]);
  const launch = useCallback((next: UnfinishedCctpSwap) => setRequest({ swap: next }), []);
  return { launch };
}
