import type { ReactElement, ReactNode } from 'react';
import { Info } from 'lucide-react';
import { ResponsiveTooltip } from './ui/tooltip';

// The glyph's focus ring is the DS ring, not the browser outline (Design QA 3314:135504).
const TRIGGER_CLASS =
  'focus-visible:ring-focusRing z-10 rounded-full focus-visible:ring-2 focus-visible:outline-hidden';

/**
 * Body of the design-system Tooltip: body-only is the Simple type (5043:58208);
 * with a `title` it is the Default type (5043:58197) — a Label 5 heading over
 * fg-secondary body copy, 8px apart.
 */
export function TooltipBody({ title, children }: { title?: ReactNode; children: ReactNode }) {
  const body = typeof children === 'string' ? <p>{children}</p> : children;
  if (!title) return body;
  return (
    <div className="text-fgSecondary flex flex-col gap-2">
      <p className="font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]">{title}</p>
      {body}
    </div>
  );
}

/**
 * Info glyph (or a custom `trigger`) opening the design-system Tooltip (Figma
 * 5043:58210): hover on pointer devices, tap on touch — see `ResponsiveTooltip`.
 */
export function InfoTooltip({
  title,
  content,
  iconClassName,
  iconSize = 13,
  trigger
}: {
  title?: ReactNode;
  content: ReactNode;
  iconClassName?: string;
  iconSize?: number;
  /**
   * Custom trigger rendered in place of the info glyph (e.g. a whole rate
   * badge). Must be a single focusable element that accepts a ref.
   */
  trigger?: ReactElement;
}) {
  return (
    <ResponsiveTooltip
      trigger={
        trigger ?? (
          <button type="button" className={TRIGGER_CLASS} aria-label="Show additional information">
            <Info size={iconSize} className={iconClassName} />
          </button>
        )
      }
    >
      <TooltipBody title={title}>{content}</TooltipBody>
    </ResponsiveTooltip>
  );
}
