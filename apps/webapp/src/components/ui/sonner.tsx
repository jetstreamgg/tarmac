import * as React from 'react';
import { Toaster as Sonner, type ToastClassnames } from 'sonner';
import { Success, Failure } from '@/modules/icons';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { FLOATING_CHAT_BP } from '@/modules/chat/hooks/useFloatingChat';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ className, toastOptions, ...props }: ToasterProps) => {
  const { bpi } = useBreakpointIndex();

  // On wide screens (3xl+), position at bottom-left to avoid conflict with floating chat area
  const position = bpi >= FLOATING_CHAT_BP ? 'bottom-left' : 'bottom-right';
  const defaultClassNames: ToastClassnames = {
    toast:
      'group flex items-start justify-between space-x-4 rounded-xl bg-container text-text p-6 pr-8 shadow-lg backdrop-blur-[50px] border border-border min-w-[356px] md:min-w-[420px] max-w-[420px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full data-[expanded=false]:overflow-hidden',
    title: 'text-sm leading-none',
    description: 'text-sm opacity-90 mt-2 leading-normal',
    actionButton:
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50',
    cancelButton:
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50',
    closeButton:
      'text-foreground/50 hover:text-foreground absolute right-3 top-3 rounded-md p-1.5 opacity-100 transition-opacity hover:opacity-100 h-4 w-4',
    content: ''
  };

  const mergedClassNames: ToastClassnames = {
    toast: cn(defaultClassNames.toast, toastOptions?.classNames?.toast),
    title: cn(defaultClassNames.title, toastOptions?.classNames?.title),
    description: cn(defaultClassNames.description, toastOptions?.classNames?.description),
    actionButton: cn(defaultClassNames.actionButton, toastOptions?.classNames?.actionButton),
    cancelButton: cn(defaultClassNames.cancelButton, toastOptions?.classNames?.cancelButton),
    closeButton: cn(defaultClassNames.closeButton, toastOptions?.classNames?.closeButton),
    content: cn(defaultClassNames.content, toastOptions?.classNames?.content)
  };

  return (
    <Sonner
      className={cn('!z-40', className)}
      position={position}
      visibleToasts={5}
      gap={14}
      closeButton={true}
      icons={{
        success: <Success />,
        error: <Failure />,
        info: <Info size={20} className="text-textEmphasis" />,
        close: <X size={16} className="text-text" />
      }}
      offset={bpi >= FLOATING_CHAT_BP ? { bottom: 40, left: 16 } : undefined}
      toastOptions={{
        ...toastOptions,
        classNames: mergedClassNames
      }}
      {...props}
    />
  );
};

export { Toaster };
