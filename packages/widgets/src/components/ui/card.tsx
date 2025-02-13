import * as React from 'react';
import { cn } from '@/lib/utils';
import { tv, type VariantProps } from 'tailwind-variants';
import { motion } from 'framer-motion';

const card = tv({
  // Base styles apply to the base component before variant styles are applied
  base: 'rounded-[20px] bg-card p-4 lg:p-5 text-text text-base font-normal leading-normal data-[status=success]:bg-primary',

  // Slot styles will apply to every slot before slot variants are applied
  slots: {
    header: 'flex justify-between space-y-1.5',
    title: '',
    description: '',
    content: '',
    footer: ''
  },

  // Variants can be different things like "size", "intent", "position", and have sub-categories
  variants: {
    // This is called "variant" for consistency, it's arbitrary, it could be called "intent".
    variant: {
      // Each variant can define classes for any slot
      default: {
        title: 'text-xl font-semibold leading-normal lg:text-2xl lg:leading-loose',
        content: 'pt-0'
      },
      pool: { base: 'leading-tight lg:px-5 lg:py-4 cursor-pointer space-y-3' },
      stats: {
        base: 'py-3 px-5 lg:px-5 w-full',
        header: 'p-0',
        title: 'text-sm font-normal leading-tight text-textSecondary',
        content: 'pt-0'
      },
      statsCompact: { base: 'p-3 lg:pl-4 lg:pb-4 lg:pt-3 lg:pr-3' },
      statsInteractive: {
        base: 'hover:bg-primary transition-gradient-and-colors group/interactive-card cursor-pointer px-4 py-3 [--gradient-opacity:0%] hover:[--gradient-opacity:100%] lg:px-4 lg:py-3 w-full',
        header: 'p-0',
        title: 'text-sm font-normal leading-tight text-textSecondary',
        content: 'pt-0 mt-1'
      },
      widget: {
        base: 'flex flex-col p-0 lg:p-0 rounded-none bg-widget',
        header: 'space-y-0 px-0 pt-0'
      },
      address: {
        base: 'py-3 px-5'
      },
      fade: { base: 'pb-3 lg:pb-3 bg-transparent bg-gradient-to-b from-card via-transparent to-transparent' },
      history: { base: 'hover:bg-cardHover' }
    }
  },

  // Default variant is applied if no other variant is specified
  defaultVariants: {
    variant: 'default'
  },

  // This matches the variant name and applies the styles to the specified slots
  compoundSlots: [
    {
      variant: 'widget',
      slots: ['base', 'header'],
      className: ''
    },
    {
      variant: 'stats',
      slots: ['base', 'header', 'title', 'content'],
      className: ''
    }
  ]
});

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof card>
>(({ className, variant, children, ...props }, ref) => (
  <div ref={ref} className={cn(card({ variant }).base(), className)} {...props}>
    {React.Children.map(children, child => {
      if (React.isValidElement(child)) {
        const childType = child.type as React.ComponentType;
        const childDisplayName = childType.displayName || '';

        // This ensures that only these card slots are affected by the variant
        if (['CardHeader', 'CardTitle', 'CardContent', 'CardFooter'].includes(childDisplayName)) {
          return React.cloneElement(child, {
            ...(child.props || {}),
            variant
          } as React.HTMLAttributes<HTMLElement> & VariantProps<typeof card>);
        }
      }
      return child;
    })}
  </div>
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof card>
>(({ variant, className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn(card({ variant }).header(), className)} {...props}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          const childType = child.type as React.ComponentType;
          const childDisplayName = childType.displayName || '';
          if (['CardTitle', 'CardDescription'].includes(childDisplayName)) {
            return React.cloneElement(child, {
              ...(child.props || {}),
              variant
            } as React.HTMLAttributes<HTMLElement> & VariantProps<typeof card>);
          }
          return React.cloneElement(child, { ...(child.props || {}) });
        }
        return child;
      })}
    </div>
  );
});
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & VariantProps<typeof card>
>(({ variant, className, ...props }, ref) => (
  <h3 ref={ref} className={cn(card({ variant }).title(), className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof card>
>(({ variant, className, ...props }, ref) => (
  <div ref={ref} className={cn(card({ variant }).content(), className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof card>
>(({ variant, className, ...props }, ref) => (
  <div ref={ref} className={cn(card({ variant }).footer(), 'flex items-center pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

const MotionCard = motion.create(Card);
const MotionCardContent = motion.create(CardContent);

export { Card, CardHeader, CardFooter, CardTitle, CardContent, MotionCard, MotionCardContent };
