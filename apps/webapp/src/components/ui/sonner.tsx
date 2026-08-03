import * as React from 'react';
import { Toaster as Sonner, type ToastClassnames } from 'sonner';
import { Failure } from '@/modules/icons';
import { Check, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCookieConsent } from '@/modules/analytics/context/CookieConsentContext';

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Design-system Toast (Figma Components/Toast 5075:17183): bg-tertiary glass
// at 16px radius and 16px padding, a Label 4 title over a Body 7 fg-secondary
// description, and the status icon on a 34px success disc (statusSuccessBg
// fill, statusSuccessBorder ring, bare 16px check). The DS only draws the
// success disc; error/info keep their existing glyphs until the DS types them.
// Sonner's own stylesheet paints [data-sonner-toast][data-styled] with
// var(--normal-bg)/border/shadow at higher specificity than one utility
// class, so the properties it sets carry Tailwind's important marker.

const SONNER_DEFAULT_OFFSET = 32;
const BANNER_BOTTOM_MARGIN = 16; // banner's bottom-4
const BANNER_TOAST_GAP = 12;

const Toaster = ({ className, toastOptions, ...props }: ToasterProps) => {
  const { bannerHeight } = useCookieConsent();
  const bottomOffset =
    bannerHeight > 0 ? BANNER_BOTTOM_MARGIN + bannerHeight + BANNER_TOAST_GAP : SONNER_DEFAULT_OFFSET;
  const defaultClassNames: ToastClassnames = {
    // Motion (Figma: Sky App: UI 1598:76070): the toast slides its own height
    // up from the bottom edge and leaves the same way, ~300ms each way on
    // easeInOutQuart.
    //
    // That direction is what sonner already does natively — it drives a `--y`
    // custom property between translateY(100%) and translateY(0), flipping the
    // sign on removal — so this only retimes it off sonner's 400ms default.
    // The `!` is required: sonner's own [data-sonner-toast] rule ships in a
    // stylesheet it injects at runtime, which lands after ours.
    //
    // The comp animates y alone, but sonner's opacity fade is kept
    // deliberately: the toaster is not a clipping container, so a toast that
    // only translated would still be visible sitting below its resting place.
    //
    // NOTE: the classes removed here — data-[state=open]:animate-in and its
    // siblings — never applied. They are Radix Toast's state model; sonner
    // marks toasts with data-mounted/data-removed and has no data-state at
    // all, so those rules had matched nothing since the sonner migration.
    toast:
      'group flex items-start! gap-3! rounded-2xl! bg-bgTertiary! border-none! shadow-none! text-fgPrimary! p-4! pr-12! backdrop-blur-[20px] min-w-[356px] md:min-w-[420px] max-w-[420px] duration-300! ease-in-out-quart! data-[expanded=false]:overflow-hidden',
    title: 'font-circle text-base leading-[18px]! font-medium tracking-[-0.32px] text-fgPrimary!',
    description: 'font-graphik text-[11px] leading-4! font-normal text-fgSecondary! mt-1',
    icon: 'size-auto! shrink-0',
    actionButton:
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 font-circle text-sm font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50',
    cancelButton:
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 font-circle text-sm font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50',
    // transform-none (not translate-none): sonner hangs its close button off
    // the corner via `transform: translate(-35%,-35%)`, which the translate
    // property doesn't reset. 24px box at 12px insets = a 16px visual gap on
    // both sides (matching the toast's p-4) with the icon centered on the
    // title line.
    closeButton:
      'text-fgSecondary! hover:text-fgPrimary! absolute right-3! left-auto! top-3! transform-none! flex items-center justify-center rounded-md bg-transparent! border-none! p-1! opacity-100 transition-colors hover:opacity-100 h-6! w-6!',
    content: ''
  };

  const mergedClassNames: ToastClassnames = {
    toast: cn(defaultClassNames.toast, toastOptions?.classNames?.toast),
    title: cn(defaultClassNames.title, toastOptions?.classNames?.title),
    description: cn(defaultClassNames.description, toastOptions?.classNames?.description),
    icon: cn(defaultClassNames.icon, toastOptions?.classNames?.icon),
    actionButton: cn(defaultClassNames.actionButton, toastOptions?.classNames?.actionButton),
    cancelButton: cn(defaultClassNames.cancelButton, toastOptions?.classNames?.cancelButton),
    closeButton: cn(defaultClassNames.closeButton, toastOptions?.classNames?.closeButton),
    content: cn(defaultClassNames.content, toastOptions?.classNames?.content)
  };

  return (
    <Sonner
      className={cn('!z-40', className)}
      position="bottom-right"
      visibleToasts={5}
      gap={14}
      offset={{ bottom: bottomOffset }}
      mobileOffset={{ bottom: bottomOffset }}
      closeButton={true}
      icons={{
        success: (
          <span className="border-statusSuccessBorder bg-statusSuccessBg text-statusSuccess flex items-center justify-center rounded-full border p-2">
            <Check size={16} />
          </span>
        ),
        error: <Failure />,
        info: <Info size={20} className="text-textEmphasis" />,
        close: <X size={16} className="text-text" />
      }}
      toastOptions={{
        ...toastOptions,
        classNames: mergedClassNames
      }}
      {...props}
    />
  );
};

export { Toaster };
