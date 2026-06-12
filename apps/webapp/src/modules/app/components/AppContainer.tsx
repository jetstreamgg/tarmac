import React from 'react';

export function AppContainer({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <main className="scrollbar-hidden bg-container group flex h-dvh w-full max-w-[480px] min-w-[375px] flex-col gap-1.5 overflow-x-hidden overflow-y-auto rounded-t-3xl border bg-blend-overlay backdrop-blur-[50px] md:my-auto md:h-[calc(100dvh-70px)] md:max-w-[1150px] md:flex-row md:overflow-hidden md:rounded-3xl md:p-3 md:pl-[10px] lg:pl-3 xl:max-h-[1080px] xl:max-w-[calc(100vw-128px)] 2xl:max-w-[1570px]">
      {children}
    </main>
  );
}
