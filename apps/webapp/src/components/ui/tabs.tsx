import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const Tabs = TabsPrimitive.Root;

/* App tabs (canonical `TabsList`/`TabsTrigger`/`TabsContent`) — original
 * components/ui look. UNCHANGED. */

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
        'w-full inline-flex items-center justify-center whitespace-nowrap h-10 p-3 text-sm font-normal leading-none text-tabPrimary light:text-textSecondary ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-surface hover:bg-surfaceHover data-[state=active]:bg-surface data-[state=active]:border-transparent data-[state=active]:text-text disabled:text-opacity duration-250 ease-out-expo',
      icons:
        'text-xs text-textSecondary flex flex-col gap-1 items-center justify-center px-2 py-2.5 rounded-xl w-[72px] md:w-16 data-[state=active]:text-text bg-radial-(--gradient-position) from-primary-start/0 to-primary-end/0 border border-transparent data-[state=active]:from-primary-start/100 data-[state=active]:to-primary-end/100 data-[state=active]:border-border hover:from-primary-start/50 hover:to-primary-end/50 disabled:hover:from-primary-start/0 disabled:hover:to-primary-end/0 transition-[background-color,background-image,opacity,border-color,color] duration-250 ease-out-expo relative'
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

/* Widget tabs (`TabsWidget*`) — original widgets look, preserved verbatim per
 * ticket A1's preserve-both decision (no TabsList background, different `icons`
 * variant + position borders, TabsContent adds mt-2). Exposed via the widget
 * shim as `TabsList`/`TabsTrigger`/`TabsContent`. (`Tabs` is identical — both are
 * `TabsPrimitive.Root` — so it is shared.) */

const TabsWidgetList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('text-muted-foreground inline-flex h-10 w-full items-center justify-center', className)}
    {...props}
  />
));
TabsWidgetList.displayName = TabsPrimitive.List.displayName;

const tabsWidgetTriggerVariants = cva('', {
  variants: {
    variant: {
      default:
        'w-full inline-flex items-center justify-center whitespace-nowrap h-10 p-3 text-sm font-normal leading-none text-tabPrimary light:text-textSecondary ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-surface hover:bg-surfaceHover data-[state=active]:bg-surface data-[state=active]:border-transparent data-[state=active]:text-text disabled:text-opacity duration-250 ease-out-expo',
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

const TabsWidgetTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsWidgetTriggerVariants>
>(({ className, variant, position, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsWidgetTriggerVariants({ variant, position }), className)}
    {...props}
  />
));
TabsWidgetTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsWidgetContent = React.forwardRef<
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
TabsWidgetContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
export { TabsWidgetList, TabsWidgetTrigger, TabsWidgetContent };
