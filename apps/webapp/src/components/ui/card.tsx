import * as React from 'react';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';

// App look — canonical, unchanged.
const cardVariants = cva(
  'bg-glassSurface text-text rounded-[28px] p-4 text-base font-normal leading-normal backdrop-blur-[20px]',
  {
    variants: {
      variant: {
        default: '',
        pool: 'leading-tight lg:px-5 lg:py-4',
        stats: 'p-5 w-full min-w-[220px]',
        statsCompact: 'p-3 lg:pl-4 lg:pb-4 lg:pt-3 lg:pr-3',
        stepper: 'w-full rounded-none border text-sm',
        spotlight: 'p-10 bg-[linear-gradient(0deg,_#581BE0_0%,_#2A197D_100%)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

const cardHeaderVariants = cva('flex justify-between space-y-1.5', {
  variants: {
    variant: {
      default: '',
      pool: '',
      stats: 'p-0',
      statsCompact: '',
      stepper: '',
      spotlight: ''
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const cardTitleVariants = cva('', {
  variants: {
    variant: {
      default: 'text-xl font-custom-450 leading-normal lg:text-2xl lg:leading-8',
      pool: '',
      stats: 'text-sm font-normal leading-tight text-textSecondary',
      statsCompact: '',
      stepper: '',
      spotlight: ''
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const cardContentVariants = cva('', {
  variants: {
    variant: {
      default: 'p-6 pt-0',
      pool: '',
      stats: 'pt-0',
      statsCompact: '',
      stepper: '',
      spotlight: ''
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const cardFooterVariants = cva('flex items-center p-6 pt-0', {
  variants: {
    variant: {
      default: '',
      pool: '',
      stats: '',
      statsCompact: '',
      stepper: '',
      spotlight: ''
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(({ className, variant, children, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props}>
    {React.Children.map(children, child => {
      if (React.isValidElement(child)) {
        const childType = child.type as React.ComponentType;
        const childDisplayName = childType.displayName || '';
        // This ensures that only these card slots are affected by the variant
        if (['CardHeader', 'CardTitle', 'CardContent', 'CardFooter'].includes(childDisplayName)) {
          return React.cloneElement(child, {
            ...(child.props || {}),
            variant
          } as React.HTMLAttributes<HTMLElement> & VariantProps<typeof cardVariants>);
        }
      }
      return child;
    })}
  </div>
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardHeaderVariants>
>(({ variant, className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn(cardHeaderVariants({ variant }), className)} {...props}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          const childType = child.type as React.ComponentType;
          const childDisplayName = childType.displayName || '';
          if (['CardTitle', 'CardDescription'].includes(childDisplayName)) {
            return React.cloneElement(child, {
              ...(child.props || {}),
              variant
            } as React.HTMLAttributes<HTMLElement> & VariantProps<typeof cardTitleVariants>);
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
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & VariantProps<typeof cardTitleVariants>
>(({ variant, className, ...props }, ref) => (
  <h3 ref={ref} className={cn(cardTitleVariants({ variant }), className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & { className?: string }
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-muted-foreground text-sm', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardContentVariants>
>(({ variant, className, ...props }, ref) => (
  <div ref={ref} className={cn(cardContentVariants({ variant }), className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardFooterVariants>
>(({ variant, className, ...props }, ref) => (
  <div ref={ref} className={cn(cardFooterVariants({ variant }), className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent };
