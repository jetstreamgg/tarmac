import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';

import { cn } from '@/lib/cn';

// App look — canonical, unchanged (superset: supports the indeterminate state).
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'focus-visible:ring-ring data-[state=checked]:text-primary-foreground border-primary ring-offset-background data-[state=checked]:from-primary-start data-[state=checked]:to-primary-end peer h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-radial-(--gradient-position)',
      className
    )}
    style={{ width: '16px', minWidth: '16px', height: '16px', borderColor: '#9492A3' }}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      forceMount
      className={cn('flex items-center justify-center text-white data-[state=unchecked]:invisible')}
    >
      {props.checked === 'indeterminate' ? (
        <Minus style={{ width: '14px', height: '15px' }} />
      ) : (
        <Check style={{ width: '14px', height: '15px' }} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

// Widget look — relocated as CheckboxWidget; the widgets/checkbox shim aliases it back.
const CheckboxWidget = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'border-textDesaturated ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-radial-(--gradient-position) data-[state=checked]:from-primary-start/100 data-[state=checked]:to-primary-end/100 data-[state=checked]:text-primary-foreground focus-visible:outline-hidden peer h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
CheckboxWidget.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox, CheckboxWidget };
