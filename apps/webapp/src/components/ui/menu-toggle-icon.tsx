import { useId, type CSSProperties } from 'react';
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
 * swap on `.nav-menu-icon` reaches every line. That swap paints the brand
 * gradient (Figma Type=Menu State=Active); it's defined here in user space
 * because a horizontal stroke has a zero-height bounding box, and SVG won't
 * paint a bbox-relative gradient (like the shared `#nav-icon-gradient`) on one.
 */
export function MenuToggleIcon({ className }: { className?: string }) {
  const gradientId = useId();
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
      style={{ '--nav-menu-icon-active-stroke': `url("#${gradientId}")` } as CSSProperties}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="8" y2="16">
          <stop stopColor="#949AFF" />
          <stop offset="1" stopColor="#504DFF" />
        </linearGradient>
      </defs>
      <path d="M2.5 4H13.5" data-line="top" />
      <path d="M2.5 8H13.5" data-line="middle" />
      <path d="M2.5 12H13.5" data-line="bottom" />
    </svg>
  );
}
