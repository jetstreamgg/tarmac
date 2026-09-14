import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const Tabs = TabsPrimitive.Root;

// App look — canonical. The default/icons recipes are unchanged; pill,
// segmented and nav are the design-system tab families (Figma Tabs
// 5029:51846, Tabs2 5039:73501, Tabs3 5043:59408).

const tabsListVariants = cva('', {
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground w-full justify-between rounded-md',
      // Tabs (5029:51846): bare row of bordered chips, 6px apart.
      pills: 'flex w-fit items-center gap-1.5',
      // Tabs2 (5039:73501): enclosed segmented control — page-colored well
      // with a glass border and a 2px inset around the items.
      segmented:
        'border-glassBorder bg-pageBackground inline-flex w-fit items-center rounded-full border p-0.5',
      // Tabs3 (5043:59408): bare row of large nav pills, 4px apart.
      nav: 'flex w-fit items-center gap-1'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListVariants> & { className?: string }
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn(tabsListVariants({ variant }), className)} {...props} />
));
TabsList.displayName = TabsPrimitive.List.displayName;

// The three design-system recipes share the gradient-brand2 active fill and
// state model (Default/Hover/Active, hover scoped to inactive triggers so the
// active look never flickers under the pointer). bg-origin-border spans the
// active gradient across the border box so the translucent active border
// blends over the local gradient color instead of a wrapped opposite stop —
// same reasoning as the button primary recipe. Non-Radix toggle groups reuse
// these recipes by setting data-state="active"/"inactive" themselves.
const tabsTriggerVariants = cva('', {
  variants: {
    variant: {
      default:
        'w-full inline-flex items-center justify-center whitespace-nowrap h-10 p-3 text-sm font-normal leading-none text-tabPrimary light:text-textSecondary ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-surface hover:bg-surfaceHover data-[state=active]:bg-surface data-[state=active]:border-transparent data-[state=active]:text-text disabled:text-opacity duration-250 ease-out-expo',
      // Tabs item (5029:51762) — Label 5 chip: 12x8 padding, glass border.
      // State=Disabled is the same chip at half opacity, inert to the pointer
      // (non-Radix pill consumers set `disabled` themselves).
      pill: 'font-circle text-text inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-2 text-sm leading-4 font-medium tracking-[-0.28px] bg-origin-border transition-colors duration-250 ease-out-expo focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focusRing disabled:pointer-events-none disabled:opacity-50 border-glassBorder data-[state=inactive]:hover:border-borderTertiary data-[state=inactive]:hover:bg-glassBadge data-[state=active]:border-borderBrandDim data-[state=active]:bg-linear-to-b data-[state=active]:from-brand2-start data-[state=active]:to-brand2-end',
      // Tabs2 item (5039:73516) — Label 6, 28px tall, borderless until active
      // (a transparent border keeps the geometry stable across states).
      segmented:
        'font-circle text-fgSecondary inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border border-transparent px-3 text-xs leading-3.5 font-medium tracking-[-0.24px] bg-origin-border transition-colors duration-250 ease-out-expo focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focusRing data-[state=inactive]:hover:bg-glassBadge data-[state=inactive]:hover:text-text data-[state=active]:border-borderBrandDim data-[state=active]:bg-linear-to-b data-[state=active]:from-brand2-start data-[state=active]:to-brand2-end data-[state=active]:text-text',
      // Tabs3 item (5043:59420) — Label 5 nav pill: 44px tall, 20px inline
      // padding, brand text on hover.
      nav: 'font-circle text-text inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border px-5 text-sm leading-4 font-medium tracking-[-0.28px] bg-origin-border transition-colors duration-250 ease-out-expo focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focusRing border-glassBorder data-[state=inactive]:hover:border-borderTertiary data-[state=inactive]:hover:bg-glassBadge data-[state=inactive]:hover:text-fgBrand data-[state=active]:border-borderBrandDim data-[state=active]:bg-linear-to-b data-[state=active]:from-brand2-start data-[state=active]:to-brand2-end',
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
      'focus-visible:ring-ring ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

// Widget look — relocated under TabsWidget*; the widgets/tabs shim aliases it back.
// (Tabs itself is shared — both trees use TabsPrimitive.Root.)

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
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    VariantProps<typeof tabsWidgetTriggerVariants>
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
      'ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
      className
    )}
    {...props}
  />
));
TabsWidgetContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants };
export { TabsWidgetList, TabsWidgetTrigger, TabsWidgetContent };
