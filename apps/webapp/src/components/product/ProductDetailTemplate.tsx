import { CSSProperties, ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { AppLink } from '@/lib/navigation';

/**
 * The reusable product-detail layout (Track C, C3 — "the gate"). Earn products
 * (Savings/Vaults/Rewards/Pendle/Expert), Portfolio consumers, and Stake all
 * render through this single template; the slot/props interface below is FROZEN
 * at C3 acceptance (Migration Mechanics conventions §5) — changing it reopens
 * C3, so consumer tracks fill the slots, never edit the template ad-hoc.
 *
 * Layer rule (mirrors EarnTable): this lives in components/product and imports
 * only components/ui + lib + hooks types. Every module-specific visual (token
 * icon, network selector, chart, position card, transactions table) is INJECTED
 * as a slot by the owning module's composition — the template never reaches into
 * a module.
 */

export interface ProductDetailToken {
  /** Token image node injected by the module (e.g. <TokenIcon/>). */
  icon: ReactNode;
  /** Brand color driving the title glow + padded outline (e.g. '#95DC89'). */
  brandColor?: string;
}

/** One row of the Details grid. The module supplies icon/label/value. */
export interface ProductDetailRow {
  id: string;
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

export interface ProductDetailAbout {
  body: ReactNode;
  /** When set, a "Learn more" link is appended to the body. */
  learnMoreHref?: string;
}

export interface ProductDetailTemplateProps {
  /** Back-link destination (e.g. ROUTES.EARN). */
  backHref: string;
  /** Back-link label; defaults to "Back to products". */
  backLabel?: ReactNode;
  token: ProductDetailToken;
  title: ReactNode;
  /** Per-product network selector, right-aligned in the header row. */
  networkSelector?: ReactNode;
  /** Top-left: the Rate/TVL chart. */
  chart: ReactNode;
  /** Top-right: the "My position" card. */
  position: ReactNode;
  details: ProductDetailRow[];
  detailsTitle?: ReactNode;
  about: ProductDetailAbout;
  aboutTitle?: ReactNode;
  /** The transactions table. */
  transactions: ReactNode;
  transactionsTitle?: ReactNode;
  /** Optional control at the right of the Transactions heading (e.g. a filter). */
  transactionsAction?: ReactNode;
  /** Optional corpus-fed FAQs section (🔶 pending design confirmation). */
  faqs?: ReactNode;
  dataTestId?: string;
}

/** Token title icon with the brand-colored glow + padded outline (Figma C3). */
function ProductGlowIcon({ token }: { token: ProductDetailToken }) {
  const { icon, brandColor } = token;
  const glow: CSSProperties | undefined = brandColor
    ? { boxShadow: `0 0 0 4px ${brandColor}33, 0 0 24px 2px ${brandColor}66` }
    : undefined;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      data-testid="product-detail-token-icon"
    >
      {brandColor && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full opacity-50 blur-lg"
          style={{ backgroundColor: brandColor }}
        />
      )}
      <span className="relative rounded-full" style={glow}>
        {icon}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-text font-circle text-lg">{children}</h2>;
}

function DetailsSection({ title, details }: { title?: ReactNode; details: ProductDetailRow[] }) {
  return (
    <section className="flex flex-col gap-4" data-testid="product-detail-details">
      <SectionHeading>{title ?? <Trans>Details</Trans>}</SectionHeading>
      <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2">
        {details.map(row => (
          <div
            key={row.id}
            className="border-borderPrimary flex items-center justify-between gap-4 border-b py-4"
          >
            <span className="text-textSecondary flex items-center gap-2 text-sm">
              {row.icon}
              {row.label}
            </span>
            <span className="text-text text-right font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AboutSection({ title, about }: { title?: ReactNode; about: ProductDetailAbout }) {
  return (
    <section className="flex flex-col gap-4" data-testid="product-detail-about">
      <SectionHeading>{title ?? <Trans>About</Trans>}</SectionHeading>
      <p className="text-textSecondary text-sm leading-relaxed">
        {about.body}
        {about.learnMoreHref && (
          <>
            {' '}
            <a
              href={about.learnMoreHref}
              target="_blank"
              rel="noreferrer"
              className="text-text font-medium underline"
            >
              <Trans>Learn more</Trans>
            </a>
          </>
        )}
      </p>
    </section>
  );
}

function TransactionsSection({
  title,
  action,
  children
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4" data-testid="product-detail-transactions">
      <div className="flex items-center justify-between">
        <SectionHeading>{title ?? <Trans>Transactions</Trans>}</SectionHeading>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ProductDetailTemplate({
  backHref,
  backLabel,
  token,
  title,
  networkSelector,
  chart,
  position,
  details,
  detailsTitle,
  about,
  aboutTitle,
  transactions,
  transactionsTitle,
  transactionsAction,
  faqs,
  dataTestId = 'product-detail'
}: ProductDetailTemplateProps) {
  return (
    <div className="flex w-full flex-col gap-8 p-4 md:px-8 md:py-10" data-testid={dataTestId}>
      {/* Header: back-link, token title (+glow), per-product network selector. */}
      <div className="flex flex-col gap-5">
        <AppLink
          to={backHref}
          className="text-textSecondary hover:text-text flex w-fit items-center gap-1 text-sm transition-colors"
          data-testid="product-detail-back"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel ?? <Trans>Back to products</Trans>}
        </AppLink>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ProductGlowIcon token={token} />
            <h1 className="text-text font-circle text-3xl">{title}</h1>
          </div>
          {networkSelector}
        </div>
      </div>

      {/* Body: chart | position on top, details/about/transactions stacked in
          the left column (the right column below position stays empty, per
          Figma). DOM order keeps the mobile single-column flow correct:
          chart → position → details → about → transactions. */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">{chart}</div>
        <div className="lg:col-start-3 lg:row-start-1">{position}</div>
        <div className="flex flex-col gap-10 lg:col-span-2 lg:col-start-1 lg:row-start-2">
          <DetailsSection title={detailsTitle} details={details} />
          <AboutSection title={aboutTitle} about={about} />
          <TransactionsSection title={transactionsTitle} action={transactionsAction}>
            {transactions}
          </TransactionsSection>
          {faqs}
        </div>
      </div>
    </div>
  );
}
