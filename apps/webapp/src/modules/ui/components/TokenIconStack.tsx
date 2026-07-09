import { Children, ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TokenIcon } from './TokenIcon';

/**
 * Design-system "Badges / Set" (Figma 5034:22071): a row of circular badges,
 * each overlapping the previous by a third of its width. Every badge carries a
 * ring in the page background color — not the surface it sits on — so the
 * front badge reads as a punched-out circle over the one behind it, and the
 * cluster keeps a consistent halo on any card or panel.
 *
 * `IconStack` is the generic stack (chain icons, custom-keyed TokenIcons, …);
 * size children with `h-full w-full`. `TokenIconStack` is the Figma set's
 * Type=Tokens flavour, building the stack from plain token symbols.
 */
export function IconStack({
  size,
  className,
  children,
  ...props
}: {
  /** Badge diameter in px; the overlap and ring scale off it. */
  size: number;
  children: ReactNode;
} & ComponentPropsWithoutRef<'span'>) {
  return (
    <span className={cn('flex items-center', className)} {...props}>
      {Children.toArray(children).map((child, index) => (
        <span
          key={index}
          className="ring-pageBackground inline-flex shrink-0 rounded-full ring-[1.5px]"
          style={{ width: size, height: size, marginLeft: index === 0 ? 0 : -size / 3 }}
        >
          {child}
        </span>
      ))}
    </span>
  );
}

export function TokenIconStack({
  symbols,
  size = 24,
  className,
  ...props
}: {
  symbols: string[];
  /** Badge diameter in px (Figma size M = 24). */
  size?: number;
} & ComponentPropsWithoutRef<'span'>) {
  return (
    <IconStack size={size} className={className} {...props}>
      {symbols.map(symbol => (
        <TokenIcon
          key={symbol}
          token={{ symbol }}
          width={size}
          showChainIcon={false}
          className="h-full w-full"
        />
      ))}
    </IconStack>
  );
}
