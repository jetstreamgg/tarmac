import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Patterns / Headers (Figma 5178:37451, header set 5031:52346): the shared
 * pieces of the five destination-page headers — Earn 5031:52345 and Convert
 * 5044:35419 (centered heroes), Portfolio 5034:20993, Savings/product-detail
 * 5039:35173 and Stake 5043:59183 (title rows). Layout differs per
 * destination and stays with each page; these primitives pin the shared type
 * scale and badge treatment so they can't drift. The title-icon ring is
 * `IconboxStatus size="l"` (iconbox.tsx) and the network pill is the
 * Button dropdown/dropdownM recipe (ChainModal / FilterSelect).
 */

const PAGE_HEADING_SIZES = {
  /** Heading 2 (44/48, -0.88): the Earn/Convert hero and Stake titles. */
  lg: 'text-[44px] leading-[48px] tracking-[-0.88px]',
  /** Heading 3 (32/35, -0.64): the Portfolio and product-detail titles. */
  md: 'text-[32px] leading-[35px] tracking-[-0.64px]'
} as const;

export function PageHeading({
  size = 'md',
  tag: Tag = 'h1',
  className,
  children
}: {
  size?: keyof typeof PAGE_HEADING_SIZES;
  tag?: 'h1' | 'h2' | 'h3';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={cn('font-circle text-fgPrimary font-medium', PAGE_HEADING_SIZES[size], className)}>
      {children}
    </Tag>
  );
}

const HEADER_BADGE_SIZES = {
  /** Hero stat badge (5031:52321): 8px padding, Label 5 text. */
  m: 'gap-1 p-2 text-sm leading-4 tracking-[-0.28px]',
  /** Title suffix badge (5119:24064): tucked padding, Label 6 text. */
  s: 'gap-1 py-1 pr-2 pl-1 text-xs leading-3.5 tracking-[-0.24px]'
} as const;

/**
 * Badges / Illustration: the glass stat pill of the hero headers ("$11.02B in
 * circulation") and, at `s`, the title-row suffix badge ("Powered by Morpho").
 * `icon` renders at 16px.
 */
export function HeaderBadge({
  icon,
  size = 'm',
  className,
  children
}: {
  icon?: React.ReactNode;
  size?: keyof typeof HEADER_BADGE_SIZES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'bg-glassBadge font-circle text-fgPrimary flex w-fit items-center rounded-full font-medium whitespace-nowrap',
        HEADER_BADGE_SIZES[size],
        className
      )}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>}
      {children}
    </span>
  );
}

/**
 * The centered hero header (Earn 5031:52345 / Convert 5044:35419): stat
 * badges over a Heading 2 title and a Body 6 subtitle. Vertical rhythm around
 * the hero stays with the page shell.
 */
export function PageHeaderHero({
  badges,
  title,
  subtitle,
  subtitleClassName,
  className
}: {
  badges?: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** DS caps the subtitle measure per page (Earn 513px, Convert 459px). */
  subtitleClassName?: string;
  className?: string;
}) {
  return (
    <header className={cn('flex w-full flex-col items-center gap-5 text-center', className)}>
      {badges && <div className="flex flex-wrap items-center justify-center gap-2">{badges}</div>}
      <PageHeading size="lg" className="max-w-[685px]">
        {title}
      </PageHeading>
      <p className={cn('text-fgSecondary max-w-[513px] text-xs leading-[18px]', subtitleClassName)}>
        {subtitle}
      </p>
    </header>
  );
}
