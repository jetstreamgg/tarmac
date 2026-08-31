import { useId } from 'react';
import { useChainId } from 'wagmi';
import { ArrowRight } from 'lucide-react';
import type { NetworkFeeData } from '@/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { NetworkFeeLabel } from '@/modules/ui/components/NetworkFeeLabel';
import { NetworkFeeValue, type BundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { SparklesMorpho, TrendingDown, TrendingUp } from '@/modules/icons';
import { useChainImage } from '@/widgets';
import { RateInfo, type RateInfoType } from './RateInfo';
import type { ModalSummaryCell } from './ModalSummaryGrid';

/**
 * The fee cell's label. Shared with `toGridCells`, which hangs the estimate's
 * tooltip and bundling panel off it — so the row builders keep emitting plain
 * strings (asserted in their tests) instead of smuggling JSX through.
 */
export const NETWORK_FEE_LABEL = 'Network fee';

/** Status colouring a value can carry (DS components/status). */
export type CellTone = 'success' | 'warning' | 'error';

const TONE_CLASS: Record<CellTone, string> = {
  success: 'text-statusSuccess',
  warning: 'text-statusWarning',
  error: 'text-statusError'
};

/** The presentation hints shared by every cell kind — see `ModalGridCell`. */
export type ModalGridCellHints = {
  label: string;
  /** Small pill after the label (Figma Badge, e.g. the slippage "Auto"/"Custom" mode). */
  labelBadge?: string;
  /** Symbol for the 12px token icon drawn before the value(s). */
  token?: string;
  /**
   * Token icon for a delta's *right* side, when the two sides are different
   * tokens (the stake review's reward-farm change: SKY → USDS). Defaults to
   * `token`, which every same-token delta keeps using.
   */
  afterToken?: string;
  /**
   * Address seeding a 12px identicon drawn before the value(s), in place of a
   * token icon (the stake review's Delegate cell).
   */
  avatar?: string;
  /** Identicon for a delta's right side. Defaults to `avatar`. */
  afterAvatar?: string;
  /** Status colour on the value — the stake review's Risk level. */
  tone?: CellTone;
  /** Status colour on a delta's right side. Defaults to `tone`. */
  afterTone?: CellTone;
  /** Draw the 12px network (chain) icon before the value. */
  network?: boolean;
  /**
   * Chain for the network icon when the transaction runs on a different chain
   * than the connected one (the Pendle engine pins mainnet). Defaults to the
   * connected chain.
   */
  networkChainId?: number;
  /**
   * Product rate treatment: 'savings' renders the value's trailing "%" through
   * the savings green gradient (deltas accent both values); 'morpho' keeps the
   * value plain and appends the morpho-gradient stars glyph (Figma
   * Icons/Custom/stars-filled) — drawn only when the rate carries extra
   * incentives, per the vault rate popover.
   */
  rateAccent?: 'savings' | 'morpho';
  /**
   * Draw the 12px trend glyph before the value: `true` the green up-arrow
   * (review Est. earnings), 'down' the red down-arrow (the Pendle "Lost on
   * early withdrawal" cell, Figma 2193:73598).
   */
  trend?: boolean | 'down';
  /**
   * Draw the value's token icon inside the ringed Iconbox / Status (review
   * Product row). 'default' = border-tertiary ring (Savings); 'morpho' /
   * 'pendle' = the product's gradient ring.
   */
  productIcon?: 'default' | 'morpho' | 'pendle';
  /** Symbol for a 12px token icon drawn after the value (vault review Est. earnings). */
  trailingToken?: string;
  /** Interactive trailing element after the value (the review slippage gear). */
  action?: React.ReactNode;
  /** Interactive element after the label (the upgrade Penalty info popover). */
  labelAction?: React.ReactNode;
  /** Rate explainer glyph after the label - keyed so the `.ts` row builders stay JSX-free (APP-540). */
  rateInfo?: RateInfoType;
  /** Draw the skeleton in place of the value while its underlying read is unresolved. */
  loading?: boolean;
};

/**
 * One labelled transaction-modal grid cell: a single value, or a before→after
 * delta (Figma "x → y"). The hints are semantic — each module's row builders
 * emit them and `toGridCells` maps them to the DS treatments (12px token
 * icons, the chain icon, the per-product rate accent). Shared by the modal
 * bodies (Savings, vaults, …) so every module draws identical grids.
 */
export type ModalGridCell = ModalGridCellHints &
  (
    | { kind: 'single'; value: string }
    | { kind: 'delta'; before: string; after: string }
    /** `◉ left = ◉ right` — the token-pair equation (upgrade Rate, Figma 1310:130775). */
    | { kind: 'pair'; left: string; right: string; rightToken: string }
    /**
     * An interactive value the builder passes through opaquely (the Pendle
     * withdraw entry's Withdrawal-token selector, Figma 2193:73598) — same
     * contract as the `action`/`labelAction` hints.
     */
    | { kind: 'node'; node: React.ReactNode }
  );

/**
 * The entry grids' collapse rule, shared by every module's row builders: a
 * before→after delta once an amount is entered, the current value alone
 * otherwise.
 */
export const singleOrDelta = (
  base: ModalGridCellHints,
  before: string,
  after: string,
  hasAmount: boolean
): ModalGridCell =>
  hasAmount ? { ...base, kind: 'delta', before, after } : { ...base, kind: 'single', value: before };

/**
 * Factories for the cells every module's row builders repeat. Emitting through
 * these keeps each label spelled once — NETWORK_FEE_LABEL especially, which
 * `toGridCells` keys the live estimate on, so a hand-typed 'Network fee'
 * that drifts would silently unhook a module's fee cell.
 */
export const networkCell = (network: string, networkChainId?: number): ModalGridCell => ({
  kind: 'single',
  label: 'Network',
  value: network,
  network: true,
  networkChainId
});

export const networkFeeCell = (networkFee: string): ModalGridCell => ({
  kind: 'single',
  label: NETWORK_FEE_LABEL,
  value: networkFee
});

/**
 * Rate cell - the label varies per module ('Savings rate' / 'Rate' / 'Fixed
 * rate'), the accent per product, and `info` picks the product's rate
 * explainer drawn after the label.
 */
export const rateCell = (
  label: string,
  rate: string,
  accent?: 'savings' | 'morpho',
  info?: RateInfoType
): ModalGridCell => ({
  kind: 'single',
  label,
  value: rate,
  rateAccent: accent,
  rateInfo: info
});

/** Review Product cell: display name + 12px token icon inside the ringed iconbox. */
export const productCell = (
  product: string,
  token: string,
  ring: 'default' | 'morpho' | 'pendle'
): ModalGridCell => ({
  kind: 'single',
  label: 'Product',
  value: product,
  token,
  productIcon: ring
});

export const withdrawalCell = (withdrawal: string): ModalGridCell => ({
  kind: 'single',
  label: 'Withdrawal',
  value: withdrawal
});

/**
 * The projected-yield label, shared by the review cells below and the entry
 * grids' `singleOrDelta` pairs so the wording is spelled once.
 */
export const EST_EARNINGS_LABEL = 'Est. 1Y yield (at current rate)';

/** Review "Est. 1Y yield" cell: green trend glyph, optional trailing denomination icon. */
export const estEarningsTrendCell = (value: string, trailingToken?: string): ModalGridCell => ({
  kind: 'single',
  label: EST_EARNINGS_LABEL,
  value,
  trend: true,
  trailingToken
});

/**
 * The savings-green treatment on a value's trailing "%" (Figma gradient-savings,
 * per WalletDrawerAssets). Negative rates render plain — a losing rate must
 * not carry the healthy-green accent.
 */
function RatePercent({ value }: { value: string }) {
  if (!value.endsWith('%') || value.startsWith('-')) return <>{value}</>;
  return (
    <>
      {value.slice(0, -1)}
      <span className="bg-gradient-to-b from-[#02c2a1] to-[#9fde88] bg-clip-text text-transparent">%</span>
    </>
  );
}

/** 12px chain icon for the Network cells — the connected chain unless the cell pins one. */
function NetworkIcon({ chainId }: { chainId?: number }) {
  const connectedChainId = useChainId();
  const src = useChainImage(chainId ?? connectedChainId);
  if (!src) return null;
  return <img src={src} alt="" className="size-3 shrink-0 rounded-full" />;
}

/**
 * 12px ring for the Product cell's gradient variants: SVG circle stroked with
 * the product gradient (Iconbox / Status, Type=Morpho / Pendle — raw hexes in
 * Figma, no variable).
 */
const RING_GRADIENTS = {
  morpho: ['#60A9FF', '#2E8EFF'],
  pendle: ['#8BF1CA', '#40E3A6']
} as const;

function GradientRing({
  variant,
  children
}: {
  variant: keyof typeof RING_GRADIENTS;
  children: React.ReactNode;
}) {
  const id = useId();
  const [from, to] = RING_GRADIENTS[variant];
  return (
    <span className="relative flex size-3 shrink-0 items-center justify-center p-0.5">
      <svg viewBox="0 0 12 12" className="absolute inset-0 size-3" fill="none" aria-hidden>
        <defs>
          <linearGradient id={id} x1="6" y1="0" x2="6" y2="12" gradientUnits="userSpaceOnUse">
            <stop stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx="6" cy="6" r="5.5" stroke={`url(#${id})`} strokeWidth="1" />
      </svg>
      {children}
    </span>
  );
}

function CellToken({ symbol, ring }: { symbol: string; ring?: 'default' | 'morpho' | 'pendle' }) {
  const icon = (
    <TokenIcon
      token={{ symbol }}
      className={ring ? 'size-full' : 'size-3 shrink-0'}
      width={12}
      showChainIcon={false}
    />
  );
  // Iconbox / Status (Figma 859:36188 / 859:38587 / 859:41307): 12px ring, tight inset.
  if (ring === 'morpho' || ring === 'pendle') return <GradientRing variant={ring}>{icon}</GradientRing>;
  if (ring === 'default') {
    return (
      <span className="border-borderTertiary flex size-3 shrink-0 items-center justify-center rounded-full border p-px">
        {icon}
      </span>
    );
  }
  return icon;
}

/** Renders one grid cell's value: optional icons, then a single value or the before→after delta. */
export function CellValue({ cell }: { cell: ModalGridCell }) {
  if (cell.loading) {
    return <Skeleton className="h-4 w-16 rounded" data-testid="cell-loading" />;
  }

  if (cell.kind === 'node') {
    return <span className="flex items-center gap-1">{cell.node}</span>;
  }

  // A delta's two sides can carry different glyphs (the stake reward-farm
  // change draws SKY → USDS, the delegate change two identicons), so the icon
  // is resolved per side; `after` falls back to `before` for the same-token
  // deltas every other module emits.
  const iconFor = (side: 'before' | 'after') => {
    if (cell.network) return <NetworkIcon chainId={cell.networkChainId} />;
    if (cell.trend === 'down') {
      return <TrendingDown boxSize={12} className="text-statusError size-3 shrink-0" aria-hidden />;
    }
    if (cell.trend) {
      return <TrendingUp boxSize={12} className="text-statusSuccessSolid size-3 shrink-0" aria-hidden />;
    }
    const avatar = side === 'after' ? (cell.afterAvatar ?? cell.avatar) : cell.avatar;
    if (avatar) {
      return (
        <span className="flex size-3 shrink-0 overflow-hidden rounded-full">
          <CustomAvatar address={avatar} size={12} />
        </span>
      );
    }
    const token = side === 'after' ? (cell.afterToken ?? cell.token) : cell.token;
    return token ? <CellToken symbol={token} ring={cell.productIcon} /> : null;
  };
  const icon = iconFor('before');

  const toneFor = (side: 'before' | 'after') =>
    (side === 'after' ? (cell.afterTone ?? cell.tone) : cell.tone) &&
    TONE_CLASS[(side === 'after' ? (cell.afterTone ?? cell.tone) : cell.tone)!];

  const accent = (value: string) => (cell.rateAccent === 'savings' ? <RatePercent value={value} /> : value);
  if (cell.kind === 'single') {
    return (
      <span className="flex items-center gap-1">
        {icon}
        <span className={toneFor('before')}>{accent(cell.value)}</span>
        {cell.rateAccent === 'morpho' && (
          <SparklesMorpho boxSize={12} className="size-3 shrink-0" aria-hidden />
        )}
        {cell.trailingToken && (
          <TokenIcon
            token={{ symbol: cell.trailingToken }}
            className="size-3 shrink-0"
            width={12}
            showChainIcon={false}
          />
        )}
        {cell.action}
      </span>
    );
  }
  // Token-pair equation (Figma 1310:130775): `◉ left = ◉ right`.
  if (cell.kind === 'pair') {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1">
          {icon}
          <span>{cell.left}</span>
        </span>
        <span aria-hidden>=</span>
        <span className="flex items-center gap-1">
          <CellToken symbol={cell.rightToken} />
          <span>{cell.right}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1">
        {icon}
        <span className={toneFor('before')}>{accent(cell.before)}</span>
      </span>
      <ArrowRight className="text-fgPrimary size-3 shrink-0" aria-hidden />
      <span className="flex items-center gap-1">
        {iconFor('after')}
        <span className={toneFor('after')}>{accent(cell.after)}</span>
      </span>
    </span>
  );
}

/**
 * Chunks an ordered cell list into the grid's rows of two. Modules whose cell
 * set is fixed spell their rows out literally; stake's is genuinely dynamic
 * (the borrow, reward and delegate cells each appear only when that leg is in
 * play), so it orders the cells it has and pairs them here — keeping the grid
 * balanced whatever collapses. Optional cells are emitted in even-sized groups
 * so a collapse never re-pairs unrelated labels.
 */
export const pairCells = (cells: ModalGridCell[]): ModalGridCell[][] =>
  cells.reduce<ModalGridCell[][]>((rows, cell, i) => {
    if (i % 2 === 0) rows.push([cell]);
    else rows[rows.length - 1].push(cell);
    return rows;
  }, []);

/** Label pill (Figma Badge, 16px tall, Label 7 on badges/bg-secondary) beside a cell label. */
function LabelBadge({ text }: { text: string }) {
  return (
    <span className="bg-glassBadge font-circle text-fgSecondary flex h-4 items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]">
      {text}
    </span>
  );
}

/**
 * The live gas estimate for the grid's `Network fee` cell (APP-418). Passing it
 * swaps that one cell's label for the tooltip and its value for the estimate +
 * bundling panel; omit it and the cell renders whatever string the builder put
 * there (the modules that have no flow to simulate yet).
 */
export type ModalGridFee = {
  fee?: NetworkFeeData;
  state: BundleFeeState;
  /** `useNetworkFee().isLoading` — draws the skeleton while the estimate is in flight. */
  loading?: boolean;
};

/** Maps builder rows to `ModalSummaryGrid` cells; test ids are `${testIdPrefix}-${label}`. */
export const toGridCells = (
  rows: ModalGridCell[][],
  testIdPrefix: string,
  networkFee?: ModalGridFee
): ModalSummaryCell[][] =>
  rows.map(row =>
    row.map(cell => {
      // The fee cell is the one place the grid renders live data rather than a
      // formatted string: the label carries the estimate's tooltip and the value
      // carries the bundling panel (Figma 1036:206739 / 1036:207086).
      const isFeeCell = !!networkFee && cell.label === NETWORK_FEE_LABEL;
      return {
        label: isFeeCell ? (
          <NetworkFeeLabel />
        ) : cell.labelBadge || cell.labelAction || cell.rateInfo ? (
          <span className="flex items-center gap-1">
            {cell.label}
            {cell.labelBadge && <LabelBadge text={cell.labelBadge} />}
            {cell.labelAction}
            {cell.rateInfo && <RateInfo type={cell.rateInfo} size={12} />}
          </span>
        ) : (
          cell.label
        ),
        testId: `${testIdPrefix}-${cell.label}`,
        content: isFeeCell ? (
          <NetworkFeeValue fee={networkFee.fee} state={networkFee.state} loading={networkFee.loading} />
        ) : (
          <CellValue cell={cell} />
        )
      };
    })
  );
