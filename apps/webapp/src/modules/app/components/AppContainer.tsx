import React from 'react';
import { cn } from '@/lib/cn';
import { pageGutterClasses } from '@/modules/layout/components/shellLayoutClasses';

/**
 * The shell's content box: the design-system page container (Figma:
 * Foundations / Grids & Spacing 5176:33992) — content capped at 1280 and
 * centered, with a 20px side gutter at the desktop tier (1320 = 1280 + 2×20).
 * Below it the container is full-width and the gutter follows the DS grid
 * tiers (pageGutterClasses, shared with the header row). Pages own only their
 * vertical padding; horizontal lives here.
 *
 * No height cap and no `overflow` of its own: pages sit directly on the page
 * background and scroll on the document (G5). The legacy `card` variant — the
 * viewport-capped inner-scroll box the two-pane routes lived in — died with
 * the last two-pane route.
 */
export function AppContainer({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    // `overflow-x-clip`, not `-hidden`: `hidden` on one axis forces the other
    // to `auto`, which makes <main> a scroll container and silently disables
    // `position: sticky` for everything inside it (the product pages' pinned
    // position card). `clip` clips the same horizontal overflow without
    // creating a scroll container.
    <main className={cn('group flex w-full max-w-[1320px] flex-col overflow-x-clip', pageGutterClasses)}>
      {children}
    </main>
  );
}
