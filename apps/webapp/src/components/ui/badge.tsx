import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

// Design-system Badge (Figma Components/Badge 5034:42277). A pill at radius-full,
// 24px tall with 8px side padding and a 4px icon gap; the label is Label 6 (12/14,
// -0.24px) in components/status/fg-brand for both fills. Only the fill differs:
// `brand` is components/status/bg-brand, `neutral` is colors/bg/bg-quarternary.
const badgeVariants = cva(
  'flex h-6 shrink-0 items-center justify-center gap-1 rounded-full px-2 font-circle text-xs leading-[14px] font-medium tracking-[-0.24px] text-statusBrand',
  {
    variants: {
      variant: {
        brand: 'bg-statusBrandBg',
        neutral: 'bg-panel'
      }
    },
    defaultVariants: { variant: 'brand' }
  }
);

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
