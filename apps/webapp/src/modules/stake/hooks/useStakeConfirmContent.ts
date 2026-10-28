import { useMemo, type ReactNode } from 'react';
import type { Call } from 'viem';
import { getCallsKey } from '@/hooks/shared/networkFee';

/** What a `transactionContent` render function receives — the engine's live routing. */
export interface StakeLaunchContentContext {
  /** The flow's calls, as the engine will send them RIGHT NOW (routing included). */
  calls: Call[];
  /** Whether they go out as one EIP-5792 bundle. */
  isBatch: boolean;
  /**
   * Legs the flow would send bundled. Not `calls.length`: with bundling off the
   * engine collapses everything into a single `multicall`, so the unbundled
   * route reports 1 for a flow bundling would still split — and the fee cell
   * would hide its own bundle toggle from exactly the people who have bundling
   * switched off.
   */
  legCount: number;
}

/** A review body: a fixed node, or one built from the engine's live routing. */
export type StakeLaunchContent = ReactNode | ((context: StakeLaunchContentContext) => ReactNode);

/**
 * Resolves a stake confirm body against the engine's routing, so its grid prices
 * the network fee of the route the engine would actually send.
 */
export function useStakeConfirmContent({
  calls,
  isBatch,
  legCount,
  content
}: StakeLaunchContentContext & { content?: StakeLaunchContent }): ReactNode {
  // A call the engine cannot encode yet must degrade the summary, not take the route down.
  const callsKey = useMemo(() => {
    try {
      return getCallsKey(calls);
    } catch {
      return null;
    }
  }, [calls]);
  // Keyed on the calldata's content: `calls` is a fresh array every render.
  const routing = useMemo<StakeLaunchContentContext>(
    () => ({ calls, isBatch, legCount }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callsKey, isBatch, legCount]
  );
  return useMemo(() => (typeof content === 'function' ? content(routing) : content), [content, routing]);
}
