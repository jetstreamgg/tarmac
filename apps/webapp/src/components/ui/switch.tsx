import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

// App look — design-system Switch (Figma 5044:49116). Sizes M (44×24, 20px
// thumb — the default) and S (28×16, 12px thumb). Off = glass fill + glass
// border; on = the shared brand gradient. Hover deepens the border, pressed
// goes solid (bg-quarternary off / bg-brand-primary on, moving only the
// gradient stops so the fill cross-fades), disabled drops the border and
// greys the thumb.
function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { size?: 'default' | 'sm' }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'group border-glassBorder bg-glassBadge peer inline-flex shrink-0 items-center rounded-full border bg-origin-border transition-all outline-none',
        'hover:border-borderTertiary',
        'data-[state=unchecked]:active:bg-glassBorder data-[state=unchecked]:active:border-transparent',
        'data-[state=checked]:from-button-gradient-start data-[state=checked]:to-button-gradient-end data-[state=checked]:bg-linear-to-b',
        'data-[state=checked]:active:from-brandHover data-[state=checked]:active:to-brandHover',
        'focus-visible:ring-focusRing focus-visible:ring-1 focus-visible:ring-offset-0',
        // Disabled overrides are stacked with the state variant: the plain
        // disabled:from-* would lose the cascade to data-[state=checked]:from-*.
        'disabled:bg-glassBorder disabled:pointer-events-none disabled:border-transparent',
        'data-[state=checked]:disabled:from-glassBorder data-[state=checked]:disabled:to-glassBorder',
        size === 'sm' ? 'h-4 w-7' : 'h-6 w-11',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'bg-fgConsistent group-data-[disabled]:bg-fgQuaternary pointer-events-none block rounded-full shadow-[0_1px_2px_0_rgba(9,4,32,0.08),0_1px_10px_0_rgba(9,4,32,0.12)] transition-transform data-[state=unchecked]:translate-x-px',
          size === 'sm'
            ? 'size-3 data-[state=checked]:translate-x-[13px]'
            : 'size-5 data-[state=checked]:translate-x-[21px]'
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
