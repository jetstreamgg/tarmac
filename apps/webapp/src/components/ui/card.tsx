import * as React from 'react';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'motion/react';

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

// Widget look — relocated under CardWidget*; the widgets/card shim aliases it back.
const cardWidgetVariants = cva(
  'rounded-[20px] bg-card p-4 lg:p-5 text-text text-base font-normal leading-normal data-[status=success]:bg-radial-(--gradient-position)',
  {
    variants: {
      variant: {
        default: '',
        pool: 'leading-tight lg:px-5 lg:py-4 cursor-pointer',
        stats: 'py-3 px-5 lg:px-5 w-full',
        statsCompact: 'p-3 lg:pl-4 lg:pb-4 lg:pt-3 lg:pr-3',
        statsInteractive:
          'hover:bg-radial-(--gradient-position) hover:from-primary-start/100 hover:to-primary-end/100 transition group/interactive-card cursor-pointer px-4 py-3 lg:px-4 lg:py-3 w-full',
        widget: 'flex flex-col p-0 lg:p-0 rounded-none bg-widget',
        address: 'py-3 px-5',
        fade: 'pb-3 lg:pb-3 bg-transparent bg-linear-to-b from-card via-transparent to-transparent',
        history:
          'hover:bg-radial-(--gradient-position) from-primary-alt-start/2 to-primary-alt-end/2 hover:from-primary-alt-start/20 hover:to-primary-alt-end/20 active:from-primary-alt-start/25 active:to-primary-alt-end/25 transition'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

const cardWidgetHeaderVariants = cva('flex justify-between space-y-1.5', {
  variants: {
    variant: {
      default: '',
      pool: '',
      stats: 'p-0',
      statsCompact: '',
      statsInteractive: 'p-0',
      widget: 'space-y-0 px-0 pt-0',
      address: '',
      fade: '',
      history: ''
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const cardWidgetTitleVariants = cva('', {
  variants: {
    variant: {
      default: 'text-xl font-semibold leading-normal lg:text-2xl lg:leading-loose',
      pool: '',
      stats: 'text-sm font-normal leading-tight text-textSecondary',
      statsCompact: '',
      statsInteractive: 'text-sm font-normal leading-tight text-textSecondary',
      widget: '',
      address: '',
      fade: '',
      history: ''
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const cardWidgetContentVariants = cva('', {
  variants: {
    variant: {
      default: 'pt-0',
      pool: '',
      stats: 'pt-0',
      statsCompact: '',
      statsInteractive: 'pt-0 mt-1',
      widget: '',
      address: '',
      fade: '',
      history: ''
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const cardWidgetFooterVariants = cva('flex items-center pt-0', {
  variants: {
    variant: {
      default: '',
      pool: '',
      stats: '',
      statsCompact: '',
      statsInteractive: '',
      widget: '',
      address: '',
      fade: '',
      history: ''
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export type CardVariant = VariantProps<typeof cardWidgetVariants>['variant'];

const CardWidget = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardWidgetVariants>
>(({ className, variant, children, ...props }, ref) => (
  <div ref={ref} className={cn(cardWidgetVariants({ variant }), className)} {...props}>
    {React.Children.map(children, child => {
      if (React.isValidElement(child)) {
        const childType = child.type as React.ComponentType;
        const childDisplayName = childType.displayName || '';

        // This ensures that only these card slots are affected by the variant
        if (['CardHeader', 'CardTitle', 'CardContent', 'CardFooter'].includes(childDisplayName)) {
          return React.cloneElement(child, {
            ...(child.props || {}),
            variant
          } as React.HTMLAttributes<HTMLElement> & VariantProps<typeof cardWidgetVariants>);
        }
      }
      return child;
    })}
  </div>
));
CardWidget.displayName = 'Card';

const CardWidgetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardWidgetHeaderVariants>
>(({ variant, className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn(cardWidgetHeaderVariants({ variant }), className)} {...props}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          const childType = child.type as React.ComponentType;
          const childDisplayName = childType.displayName || '';
          if (['CardTitle', 'CardDescription'].includes(childDisplayName)) {
            return React.cloneElement(child, {
              ...(child.props || {}),
              variant
            } as React.HTMLAttributes<HTMLElement> & VariantProps<typeof cardWidgetTitleVariants>);
          }
          return React.cloneElement(child, { ...(child.props || {}) });
        }
        return child;
      })}
    </div>
  );
});
CardWidgetHeader.displayName = 'CardHeader';

const CardWidgetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & VariantProps<typeof cardWidgetTitleVariants>
>(({ variant, className, ...props }, ref) => (
  <h3 ref={ref} className={cn(cardWidgetTitleVariants({ variant }), className)} {...props} />
));
CardWidgetTitle.displayName = 'CardTitle';

const CardWidgetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardWidgetContentVariants>
>(({ variant, className, ...props }, ref) => (
  <div ref={ref} className={cn(cardWidgetContentVariants({ variant }), className)} {...props} />
));
CardWidgetContent.displayName = 'CardContent';

const CardWidgetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardWidgetFooterVariants>
>(({ variant, className, ...props }, ref) => (
  <div ref={ref} className={cn(cardWidgetFooterVariants({ variant }), className)} {...props} />
));
CardWidgetFooter.displayName = 'CardFooter';

const MotionCard = motion.create(CardWidget);
const MotionCardContent = motion.create(CardWidgetContent);

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
export {
  CardWidget,
  CardWidgetHeader,
  CardWidgetFooter,
  CardWidgetTitle,
  CardWidgetContent,
  MotionCard,
  MotionCardContent
};
