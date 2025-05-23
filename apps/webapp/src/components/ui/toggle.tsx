import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const toggleVariants = cva(
  'inline-flex flex-col items-center rounded-xl justify-center text-sm text-textSecondary font-medium ring-offset-background transition after:bg-muted disabled:pointer-events-none disabled:opacity-50 overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'bg-transparent data-[state=on]:bg-radial-(--gradient-position) data-[state=on]:from-primary-start/100 data-[state=on]:to-primary-end/100 after:bg-primaryHover active:bg-primaryActive hover:data-[state=on]:bg-white',
        outline: 'border border-input bg-transparent after:bg-accent hover:text-accent-foreground',
        singleSwitcher:
          'rounded-md px-4 py-2 w-[64px] bg-radial-(--gradient-position) from-primary-start/0 to-primary-end/0 bg-blend-overlay hover:from-primary-start/50 hover:to-primary-end/50 data-[state=on]:from-primary-start/100 data-[state=on]:to-primary-end/100 data-[state=on]:text-text data-[state=on]:hover:bg-white/10 data-[state=on]:border-transparent transition transition-bg duration-250 ease-out-expo border border-[rgb(61,47,164)]'
      },
      size: {
        default: '',
        sm: 'h-9 px-2.5',
        lg: 'h-11 px-5'
      },
      position: {
        default: '',
        left: 'border rounded-tl-xl rounded-bl-xl',
        right: 'border border-l-0 rounded-tr-xl rounded-br-xl'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      position: 'default'
    }
  }
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, position, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className, position }), className)}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle };
