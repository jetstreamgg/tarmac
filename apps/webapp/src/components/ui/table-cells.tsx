import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import { IconboxAction, IconboxPosition, IconboxStatus } from './iconbox';

// Design-system typed table cells (Figma Table Cell 5032:9625, 17 types).
// These are cell *contents*: the surface, height and padding live on the
// ui/table TableCell (or an equivalent grid track), so the same components
// serve both <table>- and grid-built tables. Three Figma types have no
// component here on purpose: Type=Text is the TableCell default (Label 5,
// fg-primary — plain text needs no wrapper), Type=Button is the existing
// design-system <Button variant="primary" size="m"> rendered as-is, and
// Type=Risk is the shared RiskMeter pill (components/product/RiskMeter —
// one pill app-wide, restyled to the Figma Badges/Risk chrome).
//
// Typography per Figma: titles are Circular (Label 4 16/18 / Label 5 14/16),
// secondary lines are Graphik (Body 6 12/18); the Hash cell is the only one
// whose primary value uses the body font (Body 5 14/22).

const label4 = 'font-circle text-base leading-[18px] font-medium tracking-[-0.32px]';
const label5 = 'font-circle text-sm leading-4 font-medium tracking-[-0.28px]';
const label6 = 'font-circle text-xs leading-[14px] font-medium tracking-[-0.24px]';
const label7 = 'font-circle text-[11px] leading-3 font-medium tracking-[-0.22px]';
const body6 = 'font-graphik text-xs leading-[18px] font-normal';

// --- Small shared pieces ---------------------------------------------------
// The 36px circled-icon boxes the Token/Position/Action cells share come from
// the design-system Iconbox family (ui/iconbox): IconboxStatus holds the 28px
// token logo, IconboxAction/IconboxPosition draw an inner 30px disc around a
// 16px glyph.

/** Title-row chip of the Token Idle cell (rate / 1:1-parity badges). */
export function CellBadge({
  tone = 'neutral',
  children
}: {
  tone?: 'success' | 'neutral';
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        label7,
        'inline-flex h-[18px] shrink-0 items-center rounded-full px-1.5',
        tone === 'success' ? 'bg-statusSuccessBg text-statusSuccess' : 'bg-bgTertiary text-fgSecondary'
      )}
    >
      {children}
    </span>
  );
}

// The Pending badge's three-dot glyph (Icons/Custom/dots).
function DotsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="2" cy="6.5" r="1" fill="currentColor" />
      <circle cx="6" cy="5" r="1" fill="currentColor" />
      <circle cx="10" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Icons/General/move-up-right — the hash cell's external-link arrow.
function MoveUpRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M9.5 5.5V2.5H6.5M9.5 2.5L2.5 9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Typed cells -----------------------------------------------------------

/** Type=Percent: numeric value with the `%` sign dimmed to fg-tertiary. */
export function CellPercent({ value }: { value: ReactNode }) {
  return (
    <span className="flex items-center whitespace-nowrap">
      {value}
      <span className="text-fgTertiary">%</span>
    </span>
  );
}

/** Type=Empty: the en-dash placeholder for missing values. */
export function CellEmpty() {
  return <span className="text-fgTertiary">–</span>;
}

/** Type=Icon: the 16px row-link chevron (centered in fixed chevron columns). */
export function CellChevron() {
  return <ChevronRight className="text-fgTertiary size-4" aria-hidden />;
}

export type CellStatusValue = 'pending' | 'completed';

/** Type=Status: the Pending (brand) / Completed (success) pill. */
export function CellStatus({ status }: { status: CellStatusValue }) {
  return (
    <span
      className={cn(
        label6,
        'inline-flex h-6 items-center gap-1 rounded-full px-2',
        status === 'pending' ? 'bg-statusBrandBg text-statusBrand' : 'bg-statusSuccessBg text-statusSuccess'
      )}
    >
      {status === 'pending' ? (
        <>
          <DotsIcon />
          <Trans>Pending</Trans>
        </>
      ) : (
        <>
          <CheckIcon />
          <Trans>Completed</Trans>
        </>
      )}
    </span>
  );
}

/** Type=Networks: stack of 16px chain icons (size children `h-full w-full`). */
export function CellNetworks({ children }: { children: ReactNode }) {
  return <IconStack size={16}>{children}</IconStack>;
}

/**
 * Type=Token: the main two-line product cell — 36px iconbox, Label 4 title
 * (plus optional partner glyph) and a free-form Body 6 subtitle (the
 * `Supply:` token stack, an optional `· date` suffix, …).
 */
export function CellToken({
  icon,
  title,
  titleSuffix,
  subtitle,
  active
}: {
  /** 28px logo for the iconbox. */
  icon: ReactNode;
  title: ReactNode;
  /** Optional 16px partner icon after the title (Figma `showMode`). */
  titleSuffix?: ReactNode;
  subtitle?: ReactNode;
  /** Product has an active position: mint iconbox border + status dot. */
  active?: boolean;
}) {
  return (
    <span className="flex items-center gap-3">
      <IconboxStatus type={active ? 'success' : 'default'} dot={active}>
        {icon}
      </IconboxStatus>
      <span className="flex flex-col gap-0.5">
        <span className={cn(label4, 'text-fgPrimary flex items-center gap-1')}>
          {title}
          {titleSuffix}
        </span>
        {subtitle != null && (
          <span className={cn(body6, 'text-fgSecondary flex items-center gap-1')}>{subtitle}</span>
        )}
      </span>
    </span>
  );
}

/**
 * Type=Token Idle: token cell whose title row carries rate / parity badges
 * (compose from CellBadge) and whose subtitle is the token's full name.
 */
export function CellTokenIdle({
  icon,
  symbol,
  badges,
  name
}: {
  /** 28px logo for the iconbox. */
  icon: ReactNode;
  symbol: ReactNode;
  badges?: ReactNode;
  name: ReactNode;
}) {
  return (
    <span className="flex items-center gap-3">
      <IconboxStatus>{icon}</IconboxStatus>
      <span className="flex flex-col gap-0.5">
        <span className={cn(label4, 'text-fgPrimary flex items-center gap-1')}>
          {symbol}
          {badges}
        </span>
        <span className={cn(body6, 'text-fgSecondary')}>{name}</span>
      </span>
    </span>
  );
}

/** Type=Position: green position iconbox + Label 5 label (14px, not 16). */
export function CellPosition({ icon, label }: { icon: ReactNode; label: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <IconboxPosition>{icon}</IconboxPosition>
      <span className={cn(label5, 'text-fgPrimary')}>{label}</span>
    </span>
  );
}

/**
 * Type=Action (and Type=Action and Position via `compact`): circled 16px
 * action glyph + action name over a Body 6 subline (relative time, and for
 * the compact stake flavour `· Position N`).
 */
export function CellAction({
  icon,
  label,
  sublabel,
  compact
}: {
  icon: ReactNode;
  label: ReactNode;
  sublabel?: ReactNode;
  /** Label 5 title (Figma Type=Action and Position) instead of Label 4. */
  compact?: boolean;
}) {
  return (
    <span className="flex items-center gap-3">
      <IconboxAction>{icon}</IconboxAction>
      <span className="flex flex-col gap-0.5">
        <span className={cn(compact ? label5 : label4, 'text-fgPrimary')}>{label}</span>
        {sublabel != null && (
          <span className={cn(body6, 'text-fgSecondary flex items-center gap-1')}>{sublabel}</span>
        )}
      </span>
    </span>
  );
}

/** Type=Product: 12px token logo + Label 5 product name. */
export function CellProduct({ icon, label }: { icon?: ReactNode; label: ReactNode }) {
  return (
    <span className={cn(label5, 'text-fgPrimary flex items-center gap-1 whitespace-nowrap')}>
      {icon}
      {label}
    </span>
  );
}

/** Type=Amount: two-line amount — 12px logo + value over a Body 6 USD line. */
export function CellAmount({ icon, amount, usd }: { icon?: ReactNode; amount: ReactNode; usd?: ReactNode }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 whitespace-nowrap">
        {icon}
        {amount}
      </span>
      {usd != null && <span className={cn(body6, 'text-fgSecondary')}>{usd}</span>}
    </span>
  );
}

/** Type=Amount with Token: USD value with a 12px token logo *after* it. */
export function CellAmountWithToken({ amount, icon }: { amount: ReactNode; icon?: ReactNode }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {amount}
      {icon}
    </span>
  );
}

/** Type=Hash: truncated tx hash linking to the explorer (Body 5 — the body font). */
export function CellHash({ label, href }: { label: ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={event => event.stopPropagation()}
      className="text-fgSecondary hover:text-fgPrimary font-graphik flex w-fit items-center gap-1 text-sm leading-[22px] font-normal tracking-normal transition-colors"
    >
      {label}
      <MoveUpRightIcon />
    </a>
  );
}
