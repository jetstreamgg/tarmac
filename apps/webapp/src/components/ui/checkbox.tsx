import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';

import { cn } from '@/lib/cn';

// App look — design-system Checkbox (Figma 5044:49213), incl. the
// indeterminate state. Unchecked = 2px brand-dim border that deepens on
// hover/press; checked = the shared brand gradient, hover/pressed move the
// stops to the solid bg-brand-secondary/quarternary fills; disabled swaps
// everything to the bg-tertiary glass + fg-quaternary glyph.
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // rounded-[4px]: the DS radius/1 — the theme's --radius-sm is 6px.
      'group border-borderBrandDimTertiary peer size-5 shrink-0 rounded-[4px] border-2 outline-none',
      'hover:border-borderBrandDim active:border-borderBrandDim',
      'focus-visible:ring-focusRing focus-visible:ring-1 focus-visible:ring-offset-0',
      'data-[state=checked]:from-button-gradient-start data-[state=checked]:to-button-gradient-end data-[state=checked]:border-none data-[state=checked]:bg-linear-to-b',
      'data-[state=checked]:hover:from-brandPressed data-[state=checked]:hover:to-brandPressed',
      'data-[state=checked]:active:from-brandQuaternary data-[state=checked]:active:to-brandQuaternary',
      'data-[state=indeterminate]:from-button-gradient-start data-[state=indeterminate]:to-button-gradient-end data-[state=indeterminate]:border-none data-[state=indeterminate]:bg-linear-to-b',
      'data-[state=indeterminate]:hover:from-brandPressed data-[state=indeterminate]:hover:to-brandPressed',
      'data-[state=indeterminate]:active:from-brandQuaternary data-[state=indeterminate]:active:to-brandQuaternary',
      // Disabled overrides are stacked with the state variants: the plain
      // disabled:from-* would lose the cascade to data-[state=checked]:from-*.
      'disabled:border-glassBadge disabled:pointer-events-none',
      'data-[state=checked]:disabled:from-glassBadge data-[state=checked]:disabled:to-glassBadge',
      'data-[state=indeterminate]:disabled:from-glassBadge data-[state=indeterminate]:disabled:to-glassBadge',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        'text-fgConsistent group-data-[disabled]:text-fgQuaternary flex items-center justify-center'
      )}
    >
      {props.checked === 'indeterminate' ? <Minus className="size-3" /> : <Check className="size-3" />}
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
      'border-textDesaturated ring-offset-background focus-visible:ring-ring data-[state=checked]:from-primary-start/100 data-[state=checked]:to-primary-end/100 data-[state=checked]:text-primary-foreground peer h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-radial-(--gradient-position)',
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
