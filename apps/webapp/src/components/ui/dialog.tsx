import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { className?: string }
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // DS effect "background blur-full" (Figma 5579:22935 → CSS blur(100px);
      // the raw effect stores radius 200, which Figma halves in its CSS
      // translation): the scrim fully frosts the page; the modal card is a
      // near-transparent tint over it, so the frosting must come from here.
      // The scrim fades on the same 300ms curve as the card it sits under: in
      // the comp (Figma: Sky App: UI 1598:75901) the whole modal layer is one
      // fading wrapper, and only the card additionally rises.
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:ease-out-quint data-[state=closed]:ease-in-out-quart bg-modalOverlay fixed inset-0 z-50 backdrop-blur-[100px] duration-300',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { className?: string }
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // outline-hidden: Radix focuses the content container when nothing
        // inside autofocuses, and a non-pointer open (deep link, keyboard)
        // makes that focus :focus-visible — suppress the panel's UA ring, as
        // PopoverContent does; interactive children keep their own rings.
        // Motion (Figma: Sky App: UI 1598:75901): the card fades while rising
        // 40px — `slide-*-bottom-10` is exactly that 2.5rem — over 300ms,
        // arriving on quint and leaving on quart. It replaces a zoom-95 at
        // 200ms, which the comp does not do: there is no scale anywhere in it.
        // The rise composes with the centering offset rather than fighting it,
        // because Tailwind's translate utilities set the `translate` property
        // while the animation drives `transform`.
        'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-10 data-[state=open]:slide-in-from-bottom-10 data-[state=open]:ease-out-quint data-[state=closed]:ease-in-out-quart fixed top-[50%] left-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-auto min-w-[90%] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain rounded-[24px] px-5 py-4 shadow-lg outline-hidden duration-300 sm:min-w-[640px] sm:px-10 sm:py-8',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { className?: string }) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { className?: string }) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & { className?: string }
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-circle text-lg leading-none font-medium tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & { className?: string }
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('', className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
};
