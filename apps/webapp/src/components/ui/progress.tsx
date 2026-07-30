import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/cn';

// DS "Charts / Progress Bar" (Figma 5246:15689, as instantiated at 859:40960):
// a thin components/slider/bg-primary track under the brand slider gradient.
// The track used to read `bg-surface`, a bright rgba(108,104,255,0.3) periwinkle
// that competed with the fill (APP-432 item 14). `indicatorClassName` overrides
// the fill for callers that need a different tint.
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, indicatorClassName, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('bg-bgTertiary relative h-1.5 w-full overflow-hidden rounded-full', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        'from-slider-brand-start to-slider-brand-end h-full w-full flex-1 rounded-full bg-linear-to-r transition-all',
        indicatorClassName
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
