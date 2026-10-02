import { CSSProperties, ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { splitAmount } from '@/utils';
import { useAccruingValue } from '@/hooks/ui';
import { RollingDigits } from '@/components/ui/rolling-digits';
import { RollingValue } from '@/components/ui/rolling-value';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ProductBadge } from './ProductCard';

// Advance widths of Circular Medium's figures in em (proportional, so a `1` is
// barely half a `0`). Anything else falls back to the widest digit.
const GLYPH_EM: Record<string, number> = {
  '0': 0.623,
  '1': 0.366,
  '2': 0.56,
  '3': 0.574,
  '4': 0.599,
  '5': 0.558,
  '6': 0.59,
  '7': 0.529,
  '8': 0.575,
  '9': 0.587,
  ',': 0.276,
  '.': 0.265
};
// RollingDigits sets digits in tabular figures, which Circular draws all at this width.
const TABULAR_DIGIT_EM = 0.578;
const FIGURE_TRACKING_EM = -0.02;

function textWidthEm(text: string, tabularDigits = false): number {
  return [...text].reduce((total, char) => {
    const advance =
      tabularDigits && char >= '0' && char <= '9' ? TABULAR_DIGIT_EM : (GLYPH_EM[char] ?? 0.623);
    return total + advance + FIGURE_TRACKING_EM;
  }, 0);
}

/**
 * The "My position" hero shared by every product position card (the
 * ProductDetailTemplate `position` slot): a tagged pill and the position
 * balance over a soft bottom-fade inset (Figma 859:41055 — 16px radius,
 * brand-purple linear fade, 24px padding, 64px pill→figure gap).
 *
 * The figure is Heading 2 (Circular 44/48, -0.88) with a Heading 6 fraction on
 * fg-secondary. The phone tier keeps M6.3's smaller scale (486:20976).
 *
 * A discrete change — a supply or withdraw landing, a fresh chain read — rolls
 * the figure over as a whole (Design QA 2800:92561, comp 1598:76582) rather
 * than snapping it.
 */
export function PositionHero({
  pillSymbol,
  pillIcon,
  pillLabel,
  balanceSymbol,
  amount,
  ratePerSecond,
  subline
}: {
  /** Token tagged on the pill (the product's share/reward token). */
  pillSymbol?: string;
  /** Overrides the pill's token mark — /stake tags its badge with the Sky pinwheel. */
  pillIcon?: ReactNode;
  /** Defaults to "My position"; /stake's comp (1036:214138) says "Total Staked". */
  pillLabel?: ReactNode;
  /** Token the balance is denominated in. */
  balanceSymbol: string;
  /**
   * A number is split into a full-size whole and a dimmed fraction; pass a
   * pre-formatted string to render the figure whole (the /stake comp does).
   */
  amount: number | string;
  /**
   * Fractional growth per second of a continuously-compounding position. Pass it
   * and the figure accrues on screen between chain reads, its decimals rolling
   * over one at a time (Figma 1598:76444). Products that don't appreciate by the
   * second leave it off and render a still figure.
   */
  ratePerSecond?: number;
  /** Optional line under the figure, indented past the token mark (e.g. "~$120,788.90"). */
  subline?: ReactNode;
}) {
  const { value, fractionDigits } = useAccruingValue({
    amount: typeof amount === 'number' ? amount : undefined,
    ratePerSecond
  });
  // The counter picks its own precision from the balance and the rate, so a live
  // figure formats off that rather than the flat 5 decimals a still one uses.
  const isAccruing = fractionDigits !== undefined;
  const { whole, fraction } =
    typeof amount === 'number'
      ? isAccruing
        ? splitAmount(value, fractionDigits, { trimTrailingZeros: false, round: false })
        : splitAmount(amount)
      : { whole: amount, fraction: undefined };

  // From md up the figure is 44px, which a 9-digit total outgrows in a narrow
  // rail (/stake's summary card at 1200px, APP-606). Its width is estimated from
  // the glyphs rather than measured, so the size is settled on the first frame
  // and holds still while RollingValue glides its width; it only drops below
  // 44px when the figure wouldn't fit beside the token mark and the fraction.
  const fractionPx = fraction ? textWidthEm(`.${fraction}`, isAccruing) * 20 + 1 : 0;
  const figureFit = {
    '--figure-em': textWidthEm(whole, isAccruing),
    '--figure-reserve': `${40 + fractionPx}px`
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-10 rounded-2xl bg-[linear-gradient(180deg,_rgba(182,179,252,0)_50.24%,_rgba(117,111,236,0.1)_100%)] p-4 md:gap-16 md:p-6">
      <ProductBadge
        icon={
          pillIcon ??
          (pillSymbol && (
            <TokenIcon token={{ symbol: pillSymbol }} width={12} showChainIcon={false} className="h-3 w-3" />
          ))
        }
      >
        {pillLabel ?? <Trans>My position</Trans>}
      </ProductBadge>

      <div className="@container flex flex-col gap-2" style={figureFit}>
        <span className="text-fgPrimary flex items-center gap-2">
          <TokenIcon
            token={{ symbol: balanceSymbol }}
            width={32}
            showChainIcon={false}
            className="h-8 w-8 shrink-0"
          />
          <span className="flex items-baseline gap-px md:whitespace-nowrap">
            <span className="font-circle text-[32px] leading-[35px] font-medium tracking-[-0.64px] md:text-[length:min(44px,calc((100cqi_-_var(--figure-reserve))/var(--figure-em)))] md:leading-[48px] md:tracking-[-0.02em]">
              {/* A live figure is one odometer across the point: when the
                  fraction carries into the whole dollars, only the units digit
                  (and whatever it carries into) turns over, not the whole part
                  as one figure. */}
              {isAccruing ? <RollingDigits value={whole} /> : <RollingValue value={whole} />}
            </span>
            {fraction && (
              <span className="text-fgSecondary font-circle text-lg leading-5 font-medium tracking-[-0.36px] md:text-xl md:leading-[22px] md:tracking-[-0.4px]">
                .
                {isAccruing ? (
                  <RollingDigits value={fraction} />
                ) : (
                  <RollingValue value={fraction} speed="stat" />
                )}
              </span>
            )}
          </span>
        </span>
        {/* A div, not a span: /stake puts a `Skeleton` (itself a div) here
            while its SKY price is loading. */}
        {subline && <div className="text-fgSecondary pl-10 text-xs leading-[18px]">{subline}</div>}
      </div>
    </div>
  );
}
