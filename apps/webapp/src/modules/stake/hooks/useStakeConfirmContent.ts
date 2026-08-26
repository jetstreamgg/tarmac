import { useEffect, useMemo, type ReactNode } from 'react';
import type { Call } from 'viem';
import { getCallsKey } from '@/hooks/shared/networkFee';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { TxStatus } from '@/widgets/shared/constants';

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
 * Keeps the stake confirm modal's review body live for as long as it is still
 * a review.
 *
 * Stake is a review-first flow — no `entry` screen — so `launch()` opens
 * straight onto the body, and `TransactionContext` stores the launch config
 * statically. Everything the body was handed at Confirm-press would otherwise
 * be frozen there for the modal's lifetime: an in-flight farm rate stays a
 * skeleton forever, an unresolved delegate reads "No delegate", and — the one
 * that actually misinforms — the network fee keeps pricing the route the user
 * has since switched away from with the toggle inside the modal.
 *
 * So the body is re-pushed the way every entry-first module's is (see
 * `useModalEntryBody`), and frozen on the same rule: pushes stop the moment the
 * transaction leaves IDLE, so mid-flight refetches can't rewrite the summary of
 * something already signed.
 *
 * Identity is the whole game here. `calls` is a fresh array every render, so
 * the routing is memoized on the calldata's CONTENT — otherwise each push
 * re-renders the provider, which re-renders this host, which pushes again.
 */
export function useStakeConfirmContent({
  sessionId,
  calls,
  isBatch,
  legCount,
  content,
  screenContent
}: {
  /** Session this body belongs to — `updateModalContent` ignores stale ones. */
  sessionId: string;
  calls: Call[];
  isBatch: boolean;
  legCount: number;
  /** The caller's body. Pass a MEMOIZED render function; it is a dep below. */
  content?: StakeLaunchContent;
  /** Compact wallet/status-screen summary, pushed alongside it. */
  screenContent?: ReactNode;
}): ReactNode {
  const { updateModalContent, txStatus } = useTransaction();

  const callsKey = getCallsKey(calls);
  const routing = useMemo<StakeLaunchContentContext>(
    () => ({ calls, isBatch, legCount }),
    // Keyed on the calldata's content, not the array's identity — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callsKey, isBatch, legCount]
  );

  const resolved = useMemo(
    () => (typeof content === 'function' ? content(routing) : content),
    [content, routing]
  );

  useEffect(() => {
    // No-op until `launch()` has seeded this session; a no-op again for good
    // once the user has committed to the calldata.
    if (txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, {
      transactionContent: resolved,
      ...(screenContent !== undefined ? { transactionScreenContent: screenContent } : {})
    });
  }, [sessionId, txStatus, resolved, screenContent, updateModalContent]);

  return resolved;
}
