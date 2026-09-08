import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/cn';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  // hideIcon: the trigger draws no chevron of its own — for triggers whose
  // content already carries one (the network pill, whose chevron has to sit
  // inside the pill and flip with the panel).
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    className?: string;
    hideIcon?: boolean;
  }
>(({ className, children, hideIcon = false, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      // focusRing (DS token), not the shadcn `ring` slot: --color-ring is
      // undefined in globals.css, so ring-ring painted in currentColor — a
      // near-black outline in the light theme whenever Radix returns focus to
      // the trigger after a selection. Matches the Button dropdown variants.
      'border-input placeholder:text-muted-foreground bg-background focus-visible:ring-focusRing flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className
    )}
    {...props}
  >
    {children}
    {!hideIcon && (
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    )}
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton> & { className?: string }
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton> & { className?: string }
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  // matchTriggerWidth: the panel is at least as wide as its trigger, which is
  // what a normal select wants. Turn it off when the trigger is a layout row
  // rather than a control (Convert's full-width Network row) — the panel would
  // otherwise stretch across the whole card.
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    className?: string;
    position?: 'item-aligned' | 'popper';
    matchTriggerWidth?: boolean;
  }
>(({ className, children, position = 'popper', matchTriggerWidth = true, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        // Design-system Dropdown panel (Figma Components/Dropdown 5075:17292):
        // bg-tertiary glass at 16px radius with a hairline 1px/4px inset, no
        // border or shadow; rows are drawn full-bleed by SelectItem below.
        'bg-bgTertiary text-fgPrimary data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-2xl backdrop-blur-[20px]',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          'px-px py-1',
          position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full',
          position === 'popper' && matchTriggerWidth && 'min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label> & { className?: string }
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pr-2 pl-8 text-sm font-semibold', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  // hideIndicator: selection shown by the item's own checked styling instead
  // of the checkmark (V2 dropdowns highlight the selected row).
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    className?: string;
    hideIndicator?: boolean;
  }
>(({ className, children, hideIndicator = false, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      // Design-system Dropdown row: Label 5 on fg-primary with 16/12 padding;
      // the focused and selected rows tint bg-secondary and the selected row
      // pins a 16px check to the right edge.
      'focus:bg-bgSecondary data-[state=checked]:bg-bgSecondary font-circle text-fgPrimary relative flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-sm leading-4 font-medium tracking-[-0.28px] outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    {/* The checkmark takes fg-brand-primary, not the row's fg-primary
        (Figma 1036:201601 / 1036:205471 — APP-432 items 7 and 17). */}
    {!hideIndicator && (
      <SelectPrimitive.ItemIndicator className="text-fgBrand ml-auto flex size-4 items-center justify-center">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    )}
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator> & { className?: string }
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn('bg-muted -mx-1 my-1 h-px', className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton
};
