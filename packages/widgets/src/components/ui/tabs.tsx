import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@widgets/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('text-muted-foreground inline-flex h-10 w-full items-center justify-center', className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const tabsTriggerVariants = cva('', {
  variants: {
    variant: {
      default:
        'w-full inline-flex items-center justify-center whitespace-nowrap h-10 p-3 text-sm font-normal leading-none text-tabPrimary ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-surface hover:bg-surfaceHover data-[state=active]:bg-surface data-[state=active]:border-transparent data-[state=active]:text-text disabled:text-opacity duration-250 ease-out-expo',
      icons:
        'uppercase text-xs text-textSecondary flex flex-col items-center justify-center hover:bg-primaryHover hover:text-textSecondary data-[state=active]:bg-primaryActive data-[state=active]:text-text active:bg-primaryActive active:text-text focus:bg-primaryFocus'
    },
    position: {
      default: '',
      left: 'border border-r-0 rounded-tl-xl rounded-bl-xl',
      right: 'border border-l-0 rounded-tr-xl rounded-br-xl',
      middle: ''
    }
  },
  defaultVariants: {
    variant: 'default',
    position: 'default'
  }
});

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>
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
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'ring-offset-background focus-visible:ring-ring focus-visible:outline-hidden mt-2 focus-visible:ring-2 focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
