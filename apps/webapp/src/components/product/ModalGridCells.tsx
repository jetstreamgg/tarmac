import { useId } from 'react';
import { useChainId } from 'wagmi';
import { ArrowRight } from 'lucide-react';
import type { NetworkFeeData } from '@/hooks';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { NetworkFeeLabel } from '@/modules/ui/components/NetworkFeeLabel';
import { NetworkFeeValue, type BundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useChainImage } from '@/widgets';
import type { ModalSummaryCell } from './ModalSummaryGrid';

/**
 * The fee cell's label. Shared with `toGridCells`, which hangs the estimate's
 * tooltip and bundling panel off it — so the row builders keep emitting plain
 * strings (asserted in their tests) instead of smuggling JSX through.
 */
export const NETWORK_FEE_LABEL = 'Network fee';

/**
 * One labelled transaction-modal grid cell: a single value, or a before→after
 * delta (Figma "x → y"). The hints are semantic — each module's row builders
 * emit them and `toGridCells` maps them to the DS treatments (12px token
 * icons, the chain icon, the per-product rate accent). Shared by the modal
 * bodies (Savings, vaults, …) so every module draws identical grids.
 */
export type ModalGridCell = {
  label: string;
  /** Small pill after the label (Figma Badge, e.g. the slippage "Auto"/"Custom" mode). */
  labelBadge?: string;
  /** Symbol for the 12px token icon drawn before the value(s). */
  token?: string;
  /** Draw the 12px network (chain) icon before the value. */
  network?: boolean;
  /**
   * Product rate treatment: 'savings' renders the value's trailing "%" through
   * the savings green gradient (deltas accent both values); 'morpho' keeps the
   * value plain and appends the morpho-gradient stars glyph (Figma
   * Icons/Custom/stars-filled) — drawn only when the rate carries extra
   * incentives, per the vault rate popover.
   */
  rateAccent?: 'savings' | 'morpho';
  /** Draw the 12px trending-up glyph before the value (review Est. earnings). */
  trend?: boolean;
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
} & (
  | { kind: 'single'; value: string }
  | { kind: 'delta'; before: string; after: string }
  /** `◉ left = ◉ right` — the token-pair equation (upgrade Rate, Figma 1310:130775). */
  | { kind: 'pair'; left: string; right: string; rightToken: string }
);

/** The savings-green treatment on a value's trailing "%" (Figma gradient-savings, per WalletDrawerAssets). */
function RatePercent({ value }: { value: string }) {
  if (!value.endsWith('%')) return <>{value}</>;
  return (
    <>
      {value.slice(0, -1)}
      <span className="bg-gradient-to-b from-[#02c2a1] to-[#9fde88] bg-clip-text text-transparent">%</span>
    </>
  );
}

/**
 * 12px stars glyph in the morpho gradient (Figma Icons/Custom/stars-filled,
 * gradient-morpho #60a9ff→#2e8eff top→bottom) — the boosted-rate marker. Glyph
 * geometry matches the widgets `Sparkles` icon; only the fill differs.
 */
function MorphoStars() {
  const id = useId();
  return (
    <svg viewBox="0 0 16 16" className="size-3 shrink-0" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="8" y1="0" x2="8" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A9FF" />
          <stop offset="1" stopColor="#2E8EFF" />
        </linearGradient>
      </defs>
      <path
        d="M12.0699 9.38646C8.09413 8.48866 7.47829 7.87283 6.5805 3.89705C6.53936 3.71534 6.37761 3.58594 6.19071 3.58594C6.0038 3.58594 5.84205 3.71534 5.80092 3.89705C4.90272 7.87283 4.28729 8.48866 0.311512 9.38646C0.129397 9.42799 0 9.58934 0 9.77625C0 9.96315 0.129397 10.1245 0.311512 10.166C4.28729 11.0642 4.90272 11.6801 5.80092 15.6554C5.84205 15.8372 6.0038 15.9666 6.19071 15.9666C6.37761 15.9666 6.53936 15.8372 6.5805 15.6554C7.47869 11.6801 8.09413 11.0642 12.0699 10.166C12.252 10.1245 12.381 9.96315 12.381 9.77625C12.381 9.58934 12.2516 9.42799 12.0699 9.38646Z"
        fill={`url(#${id})`}
      />
      <path
        d="M15.6621 3.19819C13.5486 2.72094 13.2519 2.4242 12.7746 0.311113C12.7331 0.128998 12.5718 0 12.3849 0C12.198 0 12.0366 0.128998 11.9951 0.311113C11.5178 2.4242 11.2211 2.72094 9.10799 3.19819C8.92587 3.23973 8.79688 3.40108 8.79688 3.58798C8.79688 3.77489 8.92587 3.93624 9.10799 3.97777C11.2211 4.45503 11.5178 4.75176 11.9951 6.86525C12.0366 7.04697 12.198 7.17636 12.3849 7.17636C12.5718 7.17636 12.7331 7.04697 12.7746 6.86525C13.2519 4.75176 13.5486 4.45503 15.6621 3.97777C15.8438 3.93624 15.9732 3.77489 15.9732 3.58798C15.9732 3.40108 15.8438 3.23973 15.6621 3.19819Z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

/** 12px trending-up glyph (Figma Icons/General/trending-up) in the system-success green. */
function TrendIcon() {
  return (
    <svg viewBox="0 0 12 12" className="text-statusSuccessSolid size-3 shrink-0" fill="none" aria-hidden>
      <path
        d="M8 3.5h3v3M11 3.5 6.75 7.75l-2.5-2.5L1 8.5"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 12px chain icon for the Network cells. */
function NetworkIcon() {
  const chainId = useChainId();
  const src = useChainImage(chainId);
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
  const icon = cell.network ? (
    <NetworkIcon />
  ) : cell.trend ? (
    <TrendIcon />
  ) : cell.token ? (
    <CellToken symbol={cell.token} ring={cell.productIcon} />
  ) : null;

  const accent = (value: string) => (cell.rateAccent === 'savings' ? <RatePercent value={value} /> : value);

  if (cell.kind === 'single') {
    return (
      <span className="flex items-center gap-1">
        {icon}
        <span>{accent(cell.value)}</span>
        {cell.rateAccent === 'morpho' && <MorphoStars />}
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
        <span>{accent(cell.before)}</span>
      </span>
      <ArrowRight className="text-fgPrimary size-3 shrink-0" aria-hidden />
      <span className="flex items-center gap-1">
        {icon}
        <span>{accent(cell.after)}</span>
      </span>
    </span>
  );
}

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
        ) : cell.labelBadge || cell.labelAction ? (
          <span className="flex items-center gap-1">
            {cell.label}
            {cell.labelBadge && <LabelBadge text={cell.labelBadge} />}
            {cell.labelAction}
          </span>
        ) : (
          cell.label
        ),
        testId: `${testIdPrefix}-${cell.label}`,
        content: isFeeCell ? (
          <NetworkFeeValue fee={networkFee.fee} state={networkFee.state} />
        ) : (
          <CellValue cell={cell} />
        )
      };
    })
  );
