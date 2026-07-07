import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

// App look — canonical, unchanged.

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-[background-color,background-image,opacity,border-color,color,box-shadow] duration-250 ease-out-expo focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-primaryDisabled disabled:text-surfaceAlt light:disabled:text-textDimmed',
  {
    variants: {
      variant: {
        default: 'bg-primary text-text hover:bg-primaryHover active:bg-primaryActive focus:bg-primaryFocus',
        primary:
          'bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 text-text hover:from-primary-start/100 hover:to-primary-end/100 focus:from-primary-start/100 focus:to-primary-end/100 bg-blend-overlay hover:bg-white/10 focus:border-transparent focus:bg-white/15',
        primaryAlt:
          'bg-radial-(--gradient-position) from-primary-alt-start/100 to-primary-alt-end/100 border text-text hover:from-primary-alt-start/60 hover:to-primary-alt-end/60 active:from-primary-alt-start/45 active:to-primary-alt-end/45 focus:from-primary-alt-start/45 focus:to-primary-alt-end/45 disabled:from-primary-alt-start/35 disabled:to-primary-alt-end/35',
        connectPrimary:
          'bg-radial-(--gradient-position) text-text border border-[rgb(127,92,246)] from-primary-start/100 to-primary-end/100 hover:from-primary-start/60 hover:to-primary-end/60 hover:border-[rgb(101,70,222)] focus:from-primary-start/40 focus:to-primary-end/40 focus:border-[rgb(92,62,209)]',
        connect:
          'bg-radial-(--gradient-position) text-text border border-[rgb(127,92,246)] from-primary-bright-start/100 to-primary-bright-end/100 hover:from-primary-bright-start/60 hover:to-primary-bright-end/60 hover:border-[rgb(101,70,222)] focus:from-primary-bright-start/40 focus:to-primary-bright-end/40 focus:border-[rgb(92,62,209)]',
        secondary:
          'bg-secondary text-text hover:bg-secondaryHover active:bg-secondaryActive, focus:bg-secondaryFocus',
        pill: 'bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 text-text rounded-full hover:from-primary-start/100 hover:to-primary-end/100 focus:from-primary-start/100 focus:to-primary-end/100 bg-blend-overlay hover:bg-white/10 focus:border-transparent focus:bg-white/15 active:bg-white/15',
        chip: 'bg-secondary text-text rounded-full hover:bg-secondaryHover active:bg-secondaryActive, focus:bg-secondaryFocus',
        link: 'text-textSecondary no-underline hover:text-white light:hover:text-text active:text-[rgba(198,194,255,0.5)]',
        pagination:
          'text-selectActive text-base leading-normal bg-radial-(--gradient-position) from-primary-start/0 to-primary-end/0 rounded-full hover:from-primary-start/50 hover:to-primary-end/50 hover:text-text focus:border-2 focus:border-primaryActive focus:text-text active:text-text active:from-primary-start/30 active:to-primary-end/30 disabled:bg-radial-(--gradient-position) disabled:from-primary-start/0 disabled:to-primary-end/0 rounded-full! border-0!',
        paginationActive:
          'bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 rounded-full! text-text border-0!',
        outline:
          'text-text border border-surface hover:bg-surface/50 active:bg-surface/80 focus:bg-surface/80',
        ghost:
          'text-selectActive light:text-textSecondary hover:bg-[rgb(43,36,90)] active:bg-[rgb(49,41,100)] active:text-text light:hover:bg-surfaceAlt light:active:bg-surfaceHover',
        input:
          'bg-black/20 hover:bg-radial-(--gradient-position) hover:from-primary-alt-start/70 hover:to-primary-alt-end/70 active:bg-radial-(--gradient-position) active:from-primary-alt-start/50 active:to-primary-alt-end/50 text-text text-[13px] font-normal leading-4 disabled:pointer-events-auto disabled:cursor-not-allowed font-graphik',
        suggest:
          'bg-brandLight/10 hover:bg-radial-(--gradient-position) hover:from-primary-start/50 hover:to-primary-end/50 active:bg-radial-(--gradient-position) active:from-primary-start/35 active:to-primary-end/35 text-text',
        light: 'bg-[#EEDEFF] text-[#39128D] text-base'
      },
      size: {
        default: 'h-10 px-4 py-2',
        xs: 'h-6 rounded-full px-2 py-1 text-xs',
        sm: 'h-9 rounded-full px-2',
        large: 'p-4',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

// Widget look — relocated under ButtonWidget*; the widgets/button shim aliases it back.

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'pill'
  | 'chip'
  | 'link'
  | 'pagination'
  | 'paginationActive'
  | 'input'
  | 'primary'
  | 'primaryAlt'
  | 'ghost';

const buttonWidgetVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[12px] text-sm font-medium ring-offset-background transition-[background-color,background-image,opacity,border-color,color,box-shadow] duration-250 ease-out-expo focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-text hover:bg-primaryHover active:bg-primaryActive focus:bg-primaryFocus disabled:bg-primaryDisabled',
        primary:
          'bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 text-text hover:from-primary-start/100 hover:to-primary-end/100 focus:from-primary-start/100 focus:to-primary-end/100 bg-blend-overlay hover:bg-white/10 focus:border-transparent focus:bg-white/15',
        primaryAlt:
          'bg-radial-(--gradient-position) from-primary-alt-start/100 to-primary-alt-end/100 border text-text hover:from-primary-alt-start/60 hover:to-primary-alt-end/60 active:from-primary-alt-start/45 active:to-primary-alt-end/45 focus:from-primary-alt-start/45 focus:to-primary-alt-end/45 disabled:from-primary-alt-start/35 disabled:to-primary-alt-end/35',
        secondary:
          'bg-transparent text-text border border-textSecondary hover:bg-[rgb(77,76,111)] active:bg-[rgb(94,92,136)] disabled:border-textMuted disabled:text-textMuted',
        pill: 'bg-primary text-text rounded-full hover:bg-primaryHover active:bg-primaryActive focus:bg-primaryFocus',
        chip: 'bg-secondary text-text rounded-full hover:bg-secondaryHover active:bg-secondaryActive, focus:bg-secondaryFocus',
        link: 'text-textSecondary no-underline disabled:text-textMuted',
        purpleLink: 'text-textEmphasis',
        pagination:
          'text-selectActive light:text-textSecondary text-base leading-normal bg-radial-(--gradient-position) from-primary-alt-start/0 to-primary-alt-end/0 rounded-full hover:from-primary-alt-start/50 hover:to-primary-alt-end/50 hover:text-text focus:border-2 focus:border-primaryActive focus:text-text active:text-text active:from-primary-alt-start/30 active:to-primary-alt-end/30 disabled:bg-radial-(--gradient-position) disabled:from-primary-alt-start/0 active:to-primary-alt-end/0 rounded-full! border-0!',
        paginationActive:
          'bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 hover:bg-primaryHover rounded-full! text-text',
        input:
          'bg-black/20 light:bg-surfaceAlt hover:bg-white/10 active:bg-white/7 text-text text-[13px] font-normal leading-4 disabled:pointer-events-auto disabled:cursor-not-allowed font-graphik',
        ghost:
          'text-text hover:text-white/80 active:text-white/60 light:hover:text-text light:active:text-text'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-full px-2',
        icon: 'h-10 w-10',
        input: 'h-6 pt-[5px] pb-[3px] px-2 rounded-[32px]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonWidgetProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonWidgetVariants> {
  asChild?: boolean;
}

const ButtonWidget = React.forwardRef<HTMLButtonElement, ButtonWidgetProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonWidgetVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
ButtonWidget.displayName = 'Button';

export { Button, buttonVariants };
export { ButtonWidget, buttonWidgetVariants };
