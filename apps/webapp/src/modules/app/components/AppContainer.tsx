import React from 'react';
import { cn } from '@/lib/cn';

/**
 * The shell's content box. `card` draws the classic rounded container card — a
 * viewport-capped box that scrolls internally. `bare` drops the box entirely
 * (no height cap, no inner scroll), so full-width destination pages sit directly
 * on the page background (V2 Figma) and scroll on the document (B6).
 */
export function AppContainer({
  variant = 'card',
  children
}: {
  variant?: 'card' | 'bare';
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <main
      className={cn(
        'group flex w-full flex-col overflow-x-hidden',
        variant === 'card'
          ? // Card: the legacy width ladder + the viewport-capped inner-scroll box
            // and chrome. Untouched by the design-system grid — it dies with the
            // two-pane routes.
            'scrollbar-hidden bg-container h-dvh max-w-[480px] min-w-[375px] gap-1.5 overflow-y-auto rounded-t-3xl border bg-blend-overlay backdrop-blur-[50px] md:my-auto md:h-[calc(100dvh-70px)] md:max-w-[1150px] md:flex-row md:overflow-hidden md:rounded-3xl md:p-3 md:pl-[10px] lg:pl-3 xl:max-h-[1080px] xl:max-w-[calc(100vw-128px)] 2xl:max-w-[1570px]'
          : // Bare: the design-system container (Figma: Foundations / Grids &
            // Spacing 5176:33992) — content capped at 1280 and centered, with a
            // uniform 20px side gutter (1320 = 1280 + 2×20). Below the 1200 tier
            // the spec is full-width + 20px paddings, which the same rule yields.
            // Pages own only their vertical padding; horizontal lives here.
            'max-w-[1320px] px-5'
      )}
    >
      {children}
    </main>
  );
}
