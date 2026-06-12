import React from 'react';
import { cn } from '@/lib/cn';

/**
 * The shell's content box. `card` draws the classic rounded container card;
 * `bare` keeps the exact same sizing/scroll box but no chrome, so full-width
 * destination pages sit directly on the page background (V2 Figma) while
 * scrolling stays inside the box and the header keeps its place.
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
        'scrollbar-hidden group flex h-dvh w-full max-w-[480px] min-w-[375px] flex-col gap-1.5 overflow-x-hidden overflow-y-auto md:my-auto md:h-[calc(100dvh-70px)] md:max-w-[1150px] md:flex-row xl:max-h-[1080px] xl:max-w-[calc(100vw-128px)] 2xl:max-w-[1570px]',
        variant === 'card' &&
          'bg-container rounded-t-3xl border bg-blend-overlay backdrop-blur-[50px] md:overflow-hidden md:rounded-3xl md:p-3 md:pl-[10px] lg:pl-3'
      )}
    >
      {children}
    </main>
  );
}
