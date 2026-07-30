import { Children, Fragment, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

/** The placeholder every product surface shows for a value it cannot source. */
export const NO_VALUE = '–';

/**
 * The two CTA cards every product detail page mounts in the
 * `ProductDetailTemplate` "position" slot, plus the pieces they are built from.
 *
 * Figma (APP-432 item 16) draws one card per module, all on the same skeleton:
 * savings 859:35719 / 859:35813, Morpho 859:37947 / 859:38037, fixed yield
 * 859:40958 / 859:41055, staking 1036:208779 / 1036:214138. The modules that
 * have no comp of their own (rewards, stUSDS) compose the same parts.
 *
 * Type scale, straight from the design system:
 *  - badge label      Label 6  (Circular 12/14, -0.24)
 *  - supply headline  Heading 4 (Circular 28/30, -0.56)
 *  - position figure  Heading 2 (Circular 44/48, -0.88) + Heading 6 fraction
 *  - stat label       Body 6   (Graphik 12/18) on fg-secondary
 *  - stat value       Label 3  (Circular 18/22, -0.36) on the supply card,
 *                     Label 5  (Circular 14/16, -0.28) on the position card
 *
 * The phone tier has no comp of its own for these cards, so the desktop spec
 * lands at `md` and the smaller phone scale each card already carried (M6.3
 * 486:20976 / 486:20984, stake 1222:16799) is preserved below it.
 */

/** Product pill above the headline — "Sky Savings", "Powered by Morpho", "My position". */
export function ProductBadge({
  icon,
  className,
  children,
  ...props
}: {
  /** 12px mark; omitted by label-only badges like fixed yield's "Fixed yield". */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'bg-glassBadge text-fgSecondary font-circle flex h-6 w-fit items-center gap-1 rounded-full pr-2 pl-1 text-xs leading-[14px] font-medium tracking-[-0.24px]',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * One labelled figure. `size` picks the value scale: `lg` is the supply card's
 * Label 3 pair, `sm` the position card's Label 5 pair (which also tightens the
 * icon gap from 6px to 4px, per the comps).
 */
export function ProductStat({
  label,
  size = 'sm',
  className,
  children
}: {
  label: ReactNode;
  size?: 'lg' | 'sm';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-fgSecondary text-xs leading-[18px]">{label}</span>
      {/* A div, not a span: the loading states of these stats put a `Skeleton`
          (itself a div) in this slot. */}
      <div
        className={cn(
          'text-fgPrimary font-circle flex items-center font-medium',
          size === 'lg'
            ? 'gap-1.5 text-base leading-[18px] tracking-[-0.32px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]'
            : 'gap-1 text-sm leading-4 tracking-[-0.28px]'
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Guards a figure and the marks that tag it: a value the app cannot source is
 * the bare dash on fg-secondary, matching every other placeholder in the grid,
 * so a missing balance never reads as "0 of this token". Callers pass the
 * figure and its marks as `children`, in comp order.
 */
export function ProductFigure({ value, children }: { value: string; children: ReactNode }) {
  if (value === NO_VALUE) return <span className="text-fgSecondary">{NO_VALUE}</span>;
  return <>{children}</>;
}

/**
 * A row of `ProductStat`s split by the comps' 28px hairline, 24px clear on each
 * side. The supply card's pair sits content-width; the position card's grid
 * passes `grow` so its two columns halve the row.
 */
export function ProductStatPair({
  grow,
  className,
  children
}: {
  grow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const stats = Children.toArray(children);
  return (
    <div className={cn('flex items-center gap-6', grow && 'w-full [&>div]:flex-1', className)}>
      {stats.map((stat, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="bg-borderPrimary h-7 w-px shrink-0" aria-hidden />}
          {stat}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * A rate whose trailing "%" carries the DS success gradient (859:41055). Only
 * the position cards paint it — the supply card's Current Rate keeps the "%" in
 * the value colour — and only on rates that cannot go negative, so /stake's Net
 * APY stays plain.
 */
export function ProductPercent({ value }: { value: string }) {
  // A rate the app cannot source arrives here as the dash placeholder, which
  // reads fg-secondary like the rest of the grid rather than inheriting the
  // value colour.
  if (!value.endsWith('%')) return <span className="text-fgSecondary">{value}</span>;
  return (
    <span className="whitespace-nowrap">
      {value.slice(0, -1)}
      <span className="from-success-gradient-start to-success-gradient-end bg-linear-to-b bg-clip-text text-transparent">
        %
      </span>
    </span>
  );
}

/**
 * No-position entry card: badge row, "Supply … and earn X% APY" headline, an
 * optional blurb, a stat pair and a full-width CTA.
 */
export function ProductSupplyCard({
  badges,
  title,
  description,
  stats,
  cta,
  className,
  ...props
}: {
  badges?: ReactNode;
  title: ReactNode;
  /** Omitted by /stake, whose comp (1036:208779) carries no blurb. */
  description?: ReactNode;
  stats: ReactNode;
  cta: ReactNode;
  className?: string;
  // `title` here is the headline node, not the HTML string attribute.
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <Card className={cn('flex flex-col gap-5 p-5 md:gap-6 md:p-8', className)} {...props}>
      <div className="flex flex-col gap-5 md:pb-6">
        {badges}
        <h3 className="text-fgPrimary font-circle text-[22px] leading-6 font-medium tracking-[-0.44px] md:text-[28px] md:leading-[30px] md:tracking-[-0.56px]">
          {title}
        </h3>
        {description && <p className="text-fgSecondary text-xs leading-[18px]">{description}</p>}
      </div>
      {stats}
      {cta}
    </Card>
  );
}

/**
 * Has-position card: the `PositionHero` cover inset 6px from the card edge,
 * then a 32px body holding the 2×2 stat grid over the action buttons.
 */
export function ProductPositionCard({
  hero,
  stats,
  actions,
  className,
  ...props
}: {
  hero: ReactNode;
  stats: ReactNode;
  actions: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={cn('flex flex-col p-0', className)} {...props}>
      <div className="px-1.5 pt-1.5">{hero}</div>
      <div className="flex flex-col gap-5 p-5 md:gap-8 md:p-8">
        <div className="flex flex-col gap-5">{stats}</div>
        {actions}
      </div>
    </Card>
  );
}

/** Action row(s) below the stats — 12px apart, each button splitting the row. */
export function ProductActions({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex gap-3 [&>button]:flex-1', className)}>{children}</div>;
}
