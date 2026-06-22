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
        // Shared: the centered max-width column.
        'scrollbar-hidden group flex w-full max-w-[480px] min-w-[375px] flex-col gap-1.5 overflow-x-hidden md:max-w-[1150px] md:flex-row xl:max-w-[calc(100vw-128px)] 2xl:max-w-[1570px]',
        variant === 'card' &&
          // Card: the viewport-capped inner-scroll box + chrome. `bare` omits all
          // of this so the page flows at content height and the document scrolls.
          'bg-container h-dvh overflow-y-auto rounded-t-3xl border bg-blend-overlay backdrop-blur-[50px] md:my-auto md:h-[calc(100dvh-70px)] md:overflow-hidden md:rounded-3xl md:p-3 md:pl-[10px] lg:pl-3 xl:max-h-[1080px]'
      )}
    >
      {children}
    </main>
  );
}
