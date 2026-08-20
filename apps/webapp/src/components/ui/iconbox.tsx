import { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

// Design-system Iconbox family (Figma Components/Iconbox 5017:7668) — the
// standardized circular icon containers shared by table cells, position
// surfaces and activity rows:
// - Iconbox         (5007:72698)  bare token / glyph-on-disc + network chip
// - Iconbox2Tokens  (5007:73290)  the 4px-overlap token pair
// - IconboxStatus   (5017:7858)   ringed token with optional status dot
// - IconboxPosition (5051:145321) green (or inactive-neutral) position disc
// - IconboxAction   (5034:42418)  bordered neutral disc around a 16px glyph
//
// Figma names the Status ring types by product (Pendle / Morpho); here they
// are named by system color (success / info) since that is what the values
// are — the dots are colors/system/success and border-system-info-primary.
// Children are the caller's icons (TokenIcon, module glyphs); the box only
// draws the container, so size the child to the inner hole it documents.

// --- Iconbox (base) ----------------------------------------------------------

export type IconboxSize = 'l' | 'm' | 's' | 'xs';

// Box diameters L/M/S/XS = 40/32/28/24px.
const iconboxSize: Record<IconboxSize, string> = {
  l: 'size-10',
  m: 'size-8',
  s: 'size-7',
  xs: 'size-6'
};

// Network chip diameter + overhang per box size (Figma: 16@-4, 14@-2,
// 12.25@-1.75 — rounded to 12@-1.5 to stay on the pixel grid — 10@-2).
const iconboxNetwork: Record<IconboxSize, string> = {
  l: 'size-4 -right-1 -bottom-1',
  m: 'size-3.5 -right-0.5 -bottom-0.5',
  s: 'size-3 -right-[1.5px] -bottom-[1.5px]',
  xs: 'size-2.5 -right-0.5 -bottom-0.5'
};

/**
 * Base iconbox: a bare token logo (`type="token"`) or a glyph centered on a
 * translucent disc (`type="icon"`), with an optional network chip overhanging
 * bottom-right. Size the token child `h-full w-full`; glyphs stay 24px at `l`.
 */
export function Iconbox({
  type = 'token',
  size = 'l',
  network,
  children,
  className
}: {
  type?: 'token' | 'icon';
  size?: IconboxSize;
  /** Chain icon for the bottom-right chip (sized `h-full w-full`). */
  network?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', iconboxSize[size], className)}>
      {type === 'icon' ? (
        // The glyph disc is rgba(255,255,255,.1) in Figma with no variable.
        <span className="flex size-full items-center justify-center rounded-full bg-white/10">
          {children}
        </span>
      ) : (
        children
      )}
      {network != null && <span className={cn('absolute inline-flex', iconboxNetwork[size])}>{network}</span>}
    </span>
  );
}

/**
 * Iconbox / 2 Tokens: two 28px (`s`) tokens overlapping by 4px; the front
 * (left) token is punched out of the back one with a page-background ring,
 * and the network chip rides the back token.
 */
export function Iconbox2Tokens({
  front,
  back,
  network,
  className
}: {
  front: ReactNode;
  back: ReactNode;
  /** Chain icon for the back token's bottom-right chip. */
  network?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center', className)}>
      <span className="ring-pageBackground relative z-[1] -mr-1 inline-flex size-7 shrink-0 rounded-full ring-2">
        {front}
      </span>
      <Iconbox size="s" network={network}>
        {back}
      </Iconbox>
    </span>
  );
}

// --- Iconbox / Status --------------------------------------------------------

const iconboxStatusVariants = cva('relative inline-flex shrink-0 items-center justify-center rounded-full', {
  variants: {
    type: {
      default: 'border-borderTertiary',
      success: 'border-statusSuccessRing',
      info: 'border-statusInfoRing'
    },
    size: {
      l: 'size-16 border-2',
      // Figma types the M ring at 1.5px, but the border scale is whole-px
      // (1/2) — rounded up to 2 (APP-416).
      m: 'size-9 border-2',
      s: 'size-6 border',
      xs: 'size-4 border',
      '2xs': 'size-3 border'
    }
  },
  defaultVariants: {
    type: 'default',
    size: 'm'
  }
});

/**
 * Gap between the ring and the logo inside it, per size.
 *
 * The box owns the logo's size rather than each caller repeating it: the ring
 * diameter, the border and this gap fully determine it, so a caller that sets a
 * responsive box (the product headers run 56px on the phone tier and 64 from
 * md) gets the right logo at every tier for free. Figma measures the L box at
 * 64 overall around a 52px logo — 2px of ring and 4px of gap each side — and
 * the smaller sizes at the 28/18/10/8 the docblock lists.
 */
const iconboxStatusGap: Record<NonNullable<VariantProps<typeof iconboxStatusVariants>['size']>, string> = {
  l: 'p-1',
  m: 'p-0.5',
  s: 'p-0.5',
  xs: 'p-0.5',
  '2xs': 'p-px'
};

const iconboxStatusDot = cva('ring-pageBackground absolute rounded-full ring-2', {
  variants: {
    type: {
      success: 'bg-statusSuccessSolid',
      info: 'bg-statusInfoSolid'
    },
    size: {
      l: 'top-0.5 right-0.5 size-2.5',
      m: 'top-0 right-0 size-2',
      s: 'top-0 right-0 size-1.5',
      xs: '-top-px -right-px size-1',
      // Figma draws no dot at 2XS; the box is barely bigger than a dot.
      '2xs': 'hidden'
    }
  },
  // Must mirror the box cva's default: without it, callers that omit `size`
  // (table cells) got a box at `m` but a dot with NO size/position classes —
  // a 0×0, invisible dot (APP-416 round 3).
  defaultVariants: {
    size: 'm'
  }
});

/**
 * Iconbox / Status: the ringed token container. `default` is the resting
 * borderTertiary ring; `success` / `info` tint the ring and (with `dot`)
 * pin a solid status dot to the top-right.
 *
 * The logo is sized by the box (see `iconboxStatusGap`) — 52@l, 28@m, 18@s,
 * 10@xs, 8@2xs at the default diameters — so children need only be the mark
 * itself. Any width/height a child carries is overridden; pass `width` on a
 * `TokenIcon` purely as the raster resolution hint it is.
 */
export function IconboxStatus({
  type,
  size,
  dot = false,
  children,
  className
}: VariantProps<typeof iconboxStatusVariants> & {
  /** Show the status dot (success/info types only). */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(iconboxStatusVariants({ type, size }), iconboxStatusGap[size ?? 'm'], className)}>
      {/* The logo fills what the ring and gap leave. `[&>*]` outranks a plain
          size utility on the child, so a caller's leftover h-/w- classes can't
          reintroduce the old diameter. */}
      <span className="flex size-full items-center justify-center [&>*]:size-full">{children}</span>
      {dot && (type === 'success' || type === 'info') && (
        <span className={iconboxStatusDot({ type, size })} />
      )}
    </span>
  );
}

// --- Iconbox / Position ------------------------------------------------------

/**
 * Iconbox / Position: the 36px position marker — success-green ring and disc
 * around a 16px glyph, or the neutral `inactive` treatment for closed/empty
 * positions.
 */
export function IconboxPosition({
  inactive = false,
  children,
  className
}: {
  inactive?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px]',
        inactive ? 'border-glassBorder' : 'border-iconboxPosition',
        className
      )}
    >
      <span
        className={cn(
          // Disc pinned to Figma's 30px and centered, not `size-full` off a
          // padding: Chrome snaps the 1.5px border down to 1px, so any
          // padding-derived diameter lands a pixel wide.
          'flex size-[30px] items-center justify-center rounded-full',
          // Active glyph is fg-system-success-primary (#02c2a1, theme-invariant)
          // per the comp — statusSuccess is the lighter status-text green.
          inactive ? 'bg-bgTertiary text-fgSecondary' : 'bg-iconboxPositionBg text-statusSuccessSolid'
        )}
      >
        {children}
      </span>
    </span>
  );
}

// --- Iconbox / Action --------------------------------------------------------

/**
 * Iconbox / Action: the 36px activity-row marker — glass border around a
 * neutral 30px disc holding a 16px action glyph.
 */
export function IconboxAction({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'border-glassBorder flex size-9 shrink-0 items-center justify-center rounded-full border p-[2px]',
        className
      )}
    >
      <span className="bg-badgePrimary text-fgPrimary flex size-full items-center justify-center rounded-full">
        {children}
      </span>
    </span>
  );
}
