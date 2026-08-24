import { ReactNode, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLink } from '@/lib/navigation';
import { ROUTES } from '@/lib/routes';
import { recallEarnFilterSearch } from '@/lib/earnFilterMemory';
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
  /**
   * Product-family status tint for the header ring + dot (Iconbox / Status):
   * Morpho vaults `info` (blue), Pendle fixed `success` (green); omit for the
   * neutral borderTertiary ring. Optional — additive to the frozen C3 contract.
   */
  status?: 'success' | 'info';
}

/**
 * Going back to the Earn marketplace restores the filters it was left under
 * (APP-457). `retainOnNavigate` — which AppLink applies — drops them, so the
 * href has to carry them; AppLink merges a query string on the href over the
 * retained params. The memory is written by /earn itself and reads empty when
 * it was last seen unfiltered, so a clean landing needs no special case.
 */
export function backToMarketplace(backHref: string): string {
  if (backHref !== ROUTES.EARN) return backHref;
  const search = new URLSearchParams(recallEarnFilterSearch()).toString();
  return search ? `${backHref}?${search}` : backHref;
}

/** One row of the Details grid. The module supplies icon/label/value. */
export interface ProductDetailRow {
  id: string;
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

/**
 * Detail-row value backed by an async read: skeleton while the read is in
 * flight, the dash once it settles with nothing — so the dash keeps meaning
 * "no value exists" rather than "not loaded yet".
 */
export function DetailValue({ value, loading }: { value?: ReactNode; loading: boolean }) {
  if (value !== undefined && value !== null) return <>{value}</>;
  return loading ? <Skeleton className="h-4 w-14" /> : <>{'–'}</>;
}

export interface ProductDetailAbout {
  body: ReactNode;
  /** When set, a "Learn more in the User Risk Documentation." link is appended to the body. */
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
      {/* M6.3 mobile header ring is 56px (486:20720); 64 from md. */}
      <IconboxStatus size="l" type={token.status} dot={!!token.status} className="size-14 md:size-16">
        {token.icon}
      </IconboxStatus>
    </div>
  );
}

/* font-medium is load-bearing: font-circle alone falls to `normal` (400), which
   resolves to Circular Book 450 — the DS has no Circular Book, every Headings-family
   style is weight 500 (font-weight/label). */
function SectionHeading({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn('text-text font-circle text-lg font-medium', className)}>{children}</h2>;
}

/* M6.3 section-heading scale (486:20706): Details/About step down to Label 4,
   Transactions steps up to Heading 6; both return to Label 3 (18/22, -0.36px,
   comp 859:35722) at md. */
const minorHeadingClasses =
  'text-base leading-[18px] tracking-[-0.32px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]';
const majorHeadingClasses =
  'text-xl leading-[22px] tracking-[-0.4px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]';

function DetailsSection({ title, details }: { title?: ReactNode; details: ProductDetailRow[] }) {
  return (
    <section className="flex flex-col gap-4" data-testid="product-detail-details">
      <SectionHeading className={minorHeadingClasses}>{title ?? <Trans>Details</Trans>}</SectionHeading>
      <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2">
        {details.map(row => (
          <div
            key={row.id}
            className="border-borderPrimary flex items-center justify-between gap-4 border-b py-4"
          >
            {/* Desktop comp (859:35723): label Body 5 (Graphik 14/22), value
                Label 4 (Circular Medium 16/18, -0.32px). Mobile keeps the M6.3
                step-down — Body 6 labels and Label 5 values (486:20706). */}
            <span className="text-fgSecondary flex items-center gap-1.5 text-xs leading-[18px] md:gap-2 md:text-sm md:leading-[22px]">
              {row.icon}
              {row.label}
            </span>
            <span className="text-text font-circle text-right text-sm leading-4 font-medium tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AboutSection({ title, about }: { title?: ReactNode; about: ProductDetailAbout }) {
  return (
    <section className="flex flex-col gap-4" data-testid="product-detail-about">
      <SectionHeading className={minorHeadingClasses}>{title ?? <Trans>About</Trans>}</SectionHeading>
      {/* Body 5 on fg-secondary with an inline fg-brand-primary link
          (Figma 859:35769). Named explicitly rather than left to textSecondary:
          that token used to be the legacy lavender (rgba(198,194,255,.8)) and
          read as purple next to the comp's gray — APP-432 item 10. Dark has
          since been flipped onto fg-secondary too, so the two now match. */}
      <div className="text-fgSecondary font-graphik text-sm leading-[22px]">
        {about.body}
        {about.learnMoreHref && (
          <a href={about.learnMoreHref} target="_blank" rel="noreferrer" className="text-fgBrand ml-1">
            <Trans>Learn more in the User Risk Documentation.</Trans>
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
    // M6.3 (486:20827): on mobile the action drops under the heading as its
    // own full-width row (24px below the heading, 32px above the cards).
    <section className="flex flex-col gap-8 md:gap-4" data-testid="product-detail-transactions">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <SectionHeading className={majorHeadingClasses}>
          {title ?? <Trans>Transactions</Trans>}
        </SectionHeading>
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
  // Snapshot at mount rather than reading storage on every render: the memory
  // can't change while a product page is up (only /earn writes it), so this is
  // a value, not a subscription.
  const [backTo] = useState(() => backToMarketplace(backHref));

  return (
    <div className="flex w-full flex-col gap-8 py-4 md:py-10" data-testid={dataTestId}>
      {/* Header (Patterns/Headers, Savings type 5039:35173): Label 5 back-link
          over the ringed-icon + Heading 3 title row, network pill right. The
          DS 17px icon-title gap is normalized to 16. M6.3 mobile (486:20720):
          Label 6 back-link, 56px ring + Heading 5 title, and the network
          selector drops to its own full-width row 32px under the title. */}
      <div className="flex flex-col gap-4 md:gap-8">
        <AppLink
          to={backTo}
          className="text-fgSecondary hover:text-fgPrimary font-circle flex w-fit items-center gap-1.5 text-xs leading-[14px] font-medium tracking-[-0.24px] transition-colors md:text-sm md:leading-4 md:tracking-[-0.28px]"
          data-testid="product-detail-back"
        >
          <ChevronLeft className="size-4" />
          {backLabel ?? <Trans>Back to products</Trans>}
        </AppLink>
        <div className="flex flex-col items-stretch gap-8 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <ProductTitleIcon token={token} />
            <PageHeading
              size="md"
              className="text-2xl leading-[26px] tracking-[-0.48px] md:text-[32px] md:leading-[35px] md:tracking-[-0.64px]"
            >
              {title}
            </PageHeading>
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
          row, so all four stack, with `order` slotting the card first (M6.3,
          486:20706 — the position/hero card leads on phones): position →
          chart → details → …. Stacked rows sit 40px apart per the comp. */}
      <div
        className="desktop:grid-cols-12 desktop:gap-8 grid grid-cols-4 gap-x-5 gap-y-10 sm:grid-cols-8"
        data-testid="product-detail-body"
      >
        <div
          className="desktop:col-span-8 desktop:flex desktop:flex-col desktop:gap-8 contents"
          data-testid="product-detail-left-pane"
        >
          <div className="order-2 col-span-full">{chart}</div>
          <div className="order-3 col-span-full flex flex-col gap-12 md:gap-10">
            <DetailsSection title={detailsTitle} details={details} />
            {afterDetails && (
              <section className="flex flex-col gap-4" data-testid="product-detail-after-details">
                <SectionHeading className={minorHeadingClasses}>{afterDetails.title}</SectionHeading>
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
          className="desktop:col-span-4 desktop:col-start-9 desktop:row-start-1 desktop:self-start order-1 col-span-full"
          data-testid="product-detail-right-pane"
        >
          {position}
        </div>
      </div>
    </div>
  );
}
