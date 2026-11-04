import type { ComponentPropsWithRef, ReactElement, ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ResponsiveTooltip } from './ui/tooltip';

// The one info glyph every tooltip trigger wears (Figma Icons/General/info,
// 12px): fg-secondary with no hover effect, and the DS focus ring rather
// than the browser outline (Design QA 3314:135504). Callers don't pick its
// size — only a semantic color override (e.g. an error notice).
const GLYPH_TRIGGER_CLASS =
  'focus-visible:ring-focusRing text-fgSecondary z-10 inline-flex shrink-0 rounded-full focus-visible:ring-2 focus-visible:outline-hidden';

/** The info glyph button, for triggers that wrap `ResponsiveTooltip` directly. */
export function InfoGlyph({ className, ...props }: ComponentPropsWithRef<'button'>) {
  return (
    <button
      type="button"
      aria-label="Show additional information"
      className={cn(GLYPH_TRIGGER_CLASS, className)}
      {...props}
    >
      <Info className="size-3" aria-hidden />
    </button>
  );
}

/**
 * Body of the design-system Tooltip: body-only is the Simple type (5043:58208);
 * with a `title` it is the Default type (5043:58197) — a Label 5 heading over
 * fg-secondary body copy, 8px apart.
 */
export function TooltipBody({ title, children }: { title?: ReactNode; children: ReactNode }) {
  const body = typeof children === 'string' ? <p>{children}</p> : children;
  if (!title) return body;
  return (
    <div className="flex flex-col gap-2">
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
  trigger
}: {
  title?: ReactNode;
  content: ReactNode;
  /** Semantic color override for the glyph (its size is fixed). */
  iconClassName?: string;
  /**
   * Custom trigger rendered in place of the info glyph (e.g. a whole rate
   * badge). Must be a single focusable element that accepts a ref.
   */
  trigger?: ReactElement;
}) {
  return (
    <ResponsiveTooltip trigger={trigger ?? <InfoGlyph className={iconClassName} />}>
      <TooltipBody title={title}>{content}</TooltipBody>
    </ResponsiveTooltip>
  );
}
