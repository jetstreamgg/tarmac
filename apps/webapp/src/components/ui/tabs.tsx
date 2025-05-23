import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { className?: string }
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('bg-muted text-muted-foreground w-full justify-between rounded-md', className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const tabsTriggerVariants = cva('', {
  variants: {
    variant: {
      default:
        'w-full inline-flex items-center justify-center whitespace-nowrap h-10 p-3 text-sm font-normal leading-none text-tabPrimary ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-surface hover:bg-surfaceHover data-[state=active]:bg-surface data-[state=active]:border-transparent data-[state=active]:text-text focus:bg-neutral-950 focus:bg-tab focus:text-text disabled:text-opacity duration-250 ease-out-expo',
      icons:
        'text-xs text-textSecondary flex flex-col gap-1 items-center justify-center px-2 py-2.5 rounded-xl w-[72px] md:w-16 data-[state=active]:text-text bg-radial-(--gradient-position) from-primary-start/0 to-primary-end/0 border border-transparent data-[state=active]:from-primary-start/100 data-[state=active]:to-primary-end/100 data-[state=active]:border-border hover:from-primary-start/50 hover:to-primary-end/50 disabled:hover:from-primary-start/0 disabled:hover:to-primary-end/0 transition duration-250 ease-out-expo relative'
    },
    position: {
      default: '',
      left: 'border rounded-tl-xl rounded-bl-xl',
      right: 'border rounded-tr-xl rounded-br-xl',
      middle: '',
      whole: 'border rounded-xl'
    }
  },
  defaultVariants: {
    variant: 'default',
    position: 'default'
  }
});

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    VariantProps<typeof tabsTriggerVariants> & { className?: string }
>(({ className, variant, position, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant, position }), className)}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> & { className?: string }
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'focus-visible:ring-ring ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
