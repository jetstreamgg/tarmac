import * as React from 'react';

import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';

const ResponsiveModalContext = React.createContext(false);

const useIsBottomSheet = () => React.useContext(ResponsiveModalContext);

function ResponsiveModal(props: React.ComponentProps<typeof Dialog>) {
  // The single switch site for the Dialog (md+, ≥768px) ↔ bottom Sheet (sm,
  // <768px) composition. sm is the only sub-768 tier, so `bpi < BP.md` is exactly
  // the mobile range.
  const { bpi } = useBreakpointIndex();
  const isBottomSheet = bpi < BP.md;
  const Root = isBottomSheet ? Sheet : Dialog;

  return (
    <ResponsiveModalContext.Provider value={isBottomSheet}>
      <Root {...props} />
    </ResponsiveModalContext.Provider>
  );
}

function ResponsiveModalTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  const Trigger = useIsBottomSheet() ? SheetTrigger : DialogTrigger;
  return <Trigger {...props} />;
}

function ResponsiveModalClose(props: React.ComponentProps<typeof DialogClose>) {
  const Close = useIsBottomSheet() ? SheetClose : DialogClose;
  return <Close {...props} />;
}

function ResponsiveModalContent({
  className,
  children,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogContent> & { showCloseButton?: boolean }) {
  if (useIsBottomSheet()) {
    return (
      <SheetContent
        side="bottom"
        hideCloseButton={!showCloseButton}
        className={cn(
          'max-h-[90dvh] overflow-y-auto rounded-t-[24px] px-5 py-6',
          'max-w-full! min-w-0!',
          // outline-hidden: same suppression DialogContent carries — Radix
          // focuses the sheet container on open and a non-pointer open makes
          // that :focus-visible, drawing the UA ring around the whole sheet.
          'outline-hidden',
          className
        )}
        {...props}
      >
        {children}
      </SheetContent>
    );
  }

  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

function ResponsiveModalHeader(props: React.ComponentProps<typeof DialogHeader>) {
  const Header = useIsBottomSheet() ? SheetHeader : DialogHeader;
  return <Header {...props} />;
}

function ResponsiveModalFooter(props: React.ComponentProps<typeof DialogFooter>) {
  const Footer = useIsBottomSheet() ? SheetFooter : DialogFooter;
  return <Footer {...props} />;
}

function ResponsiveModalTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const Title = useIsBottomSheet() ? SheetTitle : DialogTitle;
  return <Title {...props} />;
}

function ResponsiveModalDescription(props: React.ComponentProps<typeof DialogDescription>) {
  const Description = useIsBottomSheet() ? SheetDescription : DialogDescription;
  return <Description {...props} />;
}

export {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalClose
};
