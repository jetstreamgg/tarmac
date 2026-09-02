import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { HeroAmount } from '@/components/product/HeroAmount';

/**
 * Token badge pill (DS Badges / Illustration, 28px): 16px token icon + Label-5
 * symbol on badges/bg-secondary. Right-aligned beside the hero amount and the
 * claim-modal reward rows (Figma 1310:130565 / 1036:190121).
 */
export function TokenBadge({ symbol }: { symbol: string }) {
  return (
    <span className="bg-glassBadge flex h-7 shrink-0 items-center gap-1 rounded-full py-1.5 pr-2 pl-1.5">
      <TokenIcon token={{ symbol }} className="size-4" width={16} showChainIcon={false} />
      <span className="font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]">
        {symbol}
      </span>
    </span>
  );
}

/**
 * Amount hero (DS Modal comp 1310:130565 / 859:36161): grey label, 32px token
 * icon, Heading-2 amount (Circular 44/48, -0.88 tracking) with an optional USD
 * sub-line, and a right-aligned token badge pill (Badges / Illustration, 28px).
 * Shared by the flows' review + wallet/status screens so every modal draws the
 * same hero above the breakdown or Actions list.
 */
export function TransactionAmountHero({
  label,
  amount,
  symbol,
  usd,
  size = 'md',
  loading = false,
  badge,
  dataTestId,
  usdTestId
}: {
  label?: ReactNode;
  amount: string;
  symbol: string;
  /** Draw a skeleton in place of the amount while its underlying read is unresolved. */
  loading?: boolean;
  /**
   * Replaces the static token pill — for a flow whose token is a choice rather
   * than a fact (the matured claim picks its payout token here, since it has
   * no amount field to carry the selector).
   */
  badge?: ReactNode;
  /** Dollar value of the amount, formatted without the `$` (e.g. "10,000.00"). Omit to hide. */
  usd?: string;
  /**
   * 'md' = 32px icon + 12px USD line (savings/rewards comps 1310:130565 /
   * 1036:190085); 'lg' = 40px icon + Body-5 USD line (the stake claim comps
   * 1036:213983 / 1036:214014 draw the larger variant).
   */
  size?: 'md' | 'lg';
  dataTestId?: string;
  usdTestId?: string;
}) {
  const lg = size === 'lg';
  return (
    <div className="flex flex-col gap-1" data-testid={dataTestId}>
      {label && <span className="text-fgSecondary text-sm leading-5.5">{label}</span>}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TokenIcon
            token={{ symbol }}
            className={lg ? 'size-10 shrink-0' : 'size-8 shrink-0'}
            width={lg ? 40 : 32}
            showChainIcon={false}
          />
          <div className="flex min-w-0 flex-col">
            {loading ? (
              <Skeleton className="my-2 h-8 w-40 rounded" data-testid="hero-loading" />
            ) : (
              <HeroAmount amount={amount} />
            )}
            {usd && (
              <span
                className={
                  lg ? 'text-fgSecondary text-sm leading-5.5' : 'text-fgSecondary text-xs leading-4.5'
                }
                data-testid={usdTestId}
              >
                ${usd}
              </span>
            )}
          </div>
        </div>
        {badge ?? <TokenBadge symbol={symbol} />}
      </div>
    </div>
  );
}
