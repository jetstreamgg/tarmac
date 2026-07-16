import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { AppLink } from '@/lib/navigation';
import { IconboxStatus } from '@/components/ui/iconbox';
import { PageHeading } from '@/components/ui/page-header';

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
 *
 * Reference consumer: SavingsProductDetail (mounted full-width at /earn/savings
 * via staticData.fullWidth) — copy its slot wiring for new products.
 */

export interface ProductDetailToken {
  /** Token image node injected by the module — a bare 48px `<TokenIcon/>`; the template supplies the DS ring. */
  icon: ReactNode;
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
  /**
   * Optional product-specific section rendered between Details and About (e.g.
   * the Vaults "Strategy" allocation breakdown). The template owns the section +
   * heading chrome (like Details/About/Transactions); the consumer supplies the
   * title + body. Backward-compatible — consumers that don't need it (Savings)
   * simply omit it.
   */
  afterDetails?: { title: ReactNode; body: ReactNode };
  about: ProductDetailAbout;
  aboutTitle?: ReactNode;
  /** The transactions table. */
  transactions: ReactNode;
  transactionsTitle?: ReactNode;
  /** Optional control at the right of the Transactions heading (e.g. a filter). */
  transactionsAction?: ReactNode;
  dataTestId?: string;
}

/**
 * Token title-icon slot. The module injects a bare 48px token logo; the
 * template rings it with the DS 64px Iconbox / Status (Headers pattern,
 * Figma 5039:35306) so the header ring treatment never drifts per product.
 */
function ProductTitleIcon({ token }: { token: ProductDetailToken }) {
  return (
    <div className="shrink-0" data-testid="product-detail-token-icon">
      <IconboxStatus size="l">{token.icon}</IconboxStatus>
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
      <div className="text-textSecondary text-sm leading-relaxed">
        {about.body}
        {about.learnMoreHref && (
          <a
            href={about.learnMoreHref}
            target="_blank"
            rel="noreferrer"
            className="text-text mt-1 inline-block font-medium underline"
          >
            <Trans>Learn more</Trans>
          </a>
        )}
      </div>
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
  afterDetails,
  about,
  aboutTitle,
  transactions,
  transactionsTitle,
  transactionsAction,
  dataTestId = 'product-detail'
}: ProductDetailTemplateProps) {
  return (
    <div className="flex w-full flex-col gap-8 py-4 md:py-10" data-testid={dataTestId}>
      {/* Header (Patterns/Headers, Savings type 5039:35173): Label 5 back-link
          over the ringed-icon + Heading 3 title row, network pill right. The
          DS 17px icon-title gap is normalized to 16. */}
      <div className="flex flex-col gap-8">
        <AppLink
          to={backHref}
          className="text-fgSecondary hover:text-fgPrimary font-circle flex w-fit items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px] transition-colors"
          data-testid="product-detail-back"
        >
          <ChevronLeft className="size-4" />
          {backLabel ?? <Trans>Back to products</Trans>}
        </AppLink>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ProductTitleIcon token={token} />
            <PageHeading size="md">{title}</PageHeading>
          </div>
          {networkSelector}
        </div>
      </div>

      {/* Body on the design grid at every tier (M3): 4 columns on mobile,
          8 on tablet, 12 at desktop — 20px gaps below desktop, 32px at it.
          Desktop places two panes side by side: the left pane (8 cols) flows
          chart → details → about → transactions; the right pane (4 cols,
          self-start) holds the position card at its own height. Below desktop
          the left pane dissolves (`contents`) and every block spans the full
          row, so all four stack, with `order` slotting the card between chart
          and details: chart → position → details → …. */}
      <div
        className="desktop:grid-cols-12 desktop:gap-8 grid grid-cols-4 gap-5 sm:grid-cols-8"
        data-testid="product-detail-body"
      >
        <div
          className="desktop:col-span-8 desktop:flex desktop:flex-col desktop:gap-8 contents"
          data-testid="product-detail-left-pane"
        >
          <div className="order-1 col-span-full">{chart}</div>
          <div className="order-3 col-span-full flex flex-col gap-10">
            <DetailsSection title={detailsTitle} details={details} />
            {afterDetails && (
              <section className="flex flex-col gap-4" data-testid="product-detail-after-details">
                <SectionHeading>{afterDetails.title}</SectionHeading>
                {afterDetails.body}
              </section>
            )}
            <AboutSection title={aboutTitle} about={about} />
            <TransactionsSection title={transactionsTitle} action={transactionsAction}>
              {transactions}
            </TransactionsSection>
          </div>
        </div>
        <div
          className="desktop:col-span-4 desktop:col-start-9 desktop:row-start-1 desktop:self-start order-2 col-span-full"
          data-testid="product-detail-right-pane"
        >
          {position}
        </div>
      </div>
    </div>
  );
}
