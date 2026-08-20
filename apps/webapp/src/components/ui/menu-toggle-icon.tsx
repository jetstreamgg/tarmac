import { cn } from '@/lib/cn';

/**
 * The navbar's hamburger, which folds into an X while its menu is open
 * (Figma 2134:88604). Three strokes in lucide's 16px geometry; the motion is
 * CSS, keyed off the Radix `data-state` on the trigger that wraps it (see the
 * `.nav-menu-icon` rules in globals.css): the outer strokes first travel to the
 * centre line, then rotate ±45°, while the middle stroke collapses the instant
 * they meet. Closing runs the same three steps backwards.
 *
 * Stroke is inherited from the `<svg>` (not set per path) so the open-state
 * gradient swap on `.nav-menu-icon` reaches every line.
 */
export function MenuToggleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden="true"
      className={cn('nav-menu-icon', className)}
    >
      <path d="M2.5 4H13.5" data-line="top" />
      <path d="M2.5 8H13.5" data-line="middle" />
      <path d="M2.5 12H13.5" data-line="bottom" />
    </svg>
  );
}
