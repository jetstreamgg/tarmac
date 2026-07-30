import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { splitAmount } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ProductBadge } from './ProductCard';

/**
 * The "My position" hero shared by every product position card (the
 * ProductDetailTemplate `position` slot): a tagged pill and the position
 * balance over a soft bottom-fade inset (Figma 859:41055 — 16px radius,
 * brand-purple linear fade, 24px padding, 64px pill→figure gap).
 *
 * The figure is Heading 2 (Circular 44/48, -0.88) with a Heading 6 fraction on
 * fg-secondary. The phone tier keeps M6.3's smaller scale (486:20976).
 */
export function PositionHero({
  pillSymbol,
  pillIcon,
  pillLabel,
  balanceSymbol,
  amount,
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
  /** Optional line under the figure, indented past the token mark (e.g. "~$120,788.90"). */
  subline?: ReactNode;
}) {
  const { whole, fraction } =
    typeof amount === 'number' ? splitAmount(amount) : { whole: amount, fraction: undefined };

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

      <div className="flex flex-col gap-2">
        <span className="text-fgPrimary flex items-center gap-2">
          <TokenIcon
            token={{ symbol: balanceSymbol }}
            width={32}
            showChainIcon={false}
            className="h-8 w-8 shrink-0"
          />
          <span className="flex items-baseline gap-px">
            <span className="font-circle text-[32px] leading-[35px] font-medium tracking-[-0.64px] md:text-[44px] md:leading-[48px] md:tracking-[-0.88px]">
              {whole}
            </span>
            {fraction && (
              <span className="text-fgSecondary font-circle text-lg leading-5 font-medium tracking-[-0.36px] md:text-xl md:leading-[22px] md:tracking-[-0.4px]">
                .{fraction}
              </span>
            )}
          </span>
        </span>
        {subline && <span className="text-fgSecondary pl-10 text-xs leading-[18px]">{subline}</span>}
      </div>
    </div>
  );
}
