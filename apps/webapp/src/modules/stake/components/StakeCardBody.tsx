import { ReactNode, memo } from 'react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';

/**
 * Toggleable card body (Design QA 3335:161897, Figma Motion 3335:162694): the
 * card grows/shrinks to the content height instead of jumping while the body
 * drifts up and fades in. Radix unmounts the body once the collapse finishes,
 * so the card still resets its inner state and stops its queries when off.
 * The header→body spacing lives inside the animated box so it grows with it;
 * the root is `contents` so it never adds a flex row of its own. While
 * closing, the body keeps painting the last open render: the flow state
 * resets on the click (amount to zero, delegate cleared), and the collapsing
 * frames must not flash that reset before the body is gone.
 */
export function StakeCardBody({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <Collapsible open={open} className="contents">
      <CollapsibleContent className="data-[state=open]:animate-card-expand data-[state=closed]:animate-card-collapse overflow-clip [overflow-clip-margin:4px] data-[state=closed]:pointer-events-none motion-reduce:animate-none">
        <div className="pt-6 md:pt-8">
          <FrozenWhileClosed open={open}>{children}</FrozenWhileClosed>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Skips every re-render while closed, so the collapsing body paints its last open frame. */
const FrozenWhileClosed = memo(
  ({ children }: { open: boolean; children: ReactNode }) => <>{children}</>,
  (_prev, next) => !next.open
);
