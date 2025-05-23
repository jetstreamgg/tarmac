import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'focus-visible:ring-ring data-[state=checked]:text-primary-foreground border-primary ring-offset-background data-[state=checked]:bg-radial-(--gradient-position) data-[state=checked]:from-primary-start/100 data-[state=checked]:to-primary-end/100 focus-visible:outline-hidden peer h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    style={{ width: '16px', minWidth: '16px', height: '16px', borderColor: '#9492A3' }}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-white')}>
      <Check style={{ width: '14px', height: '15px' }} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
