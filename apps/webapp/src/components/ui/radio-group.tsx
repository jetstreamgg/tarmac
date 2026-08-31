import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cn } from '@/lib/cn';

// App look — design-system Radio (Figma 5044:49317). Unchecked = 2px
// brand-dim border that deepens on hover/press; checked = solid
// bg-brand-secondary with a 4px white ring whose center hole shows the fill
// through (pressed darkens to bg-brand-quarternary); disabled swaps to the
// glass fills and the fg-quaternary ring.
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root data-slot="radio-group" className={cn('grid gap-2', className)} {...props} />
  );
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'group border-borderBrandDimTertiary peer size-5 shrink-0 rounded-full border-2 outline-none',
        'hover:border-borderBrandDim active:border-borderBrandDim',
        'focus-visible:ring-focusRing focus-visible:ring-1 focus-visible:ring-offset-0',
        'data-[state=checked]:bg-brandPressed data-[state=checked]:border-none',
        'data-[state=checked]:active:bg-brandQuaternary',
        'disabled:border-glassBorder data-[state=checked]:disabled:bg-glassBadge disabled:pointer-events-none',
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <span
          aria-hidden
          className="border-fgConsistent group-data-[disabled]:border-fgQuaternary group-data-[disabled]:bg-borderQuarternary block size-3 rounded-full border-4"
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
