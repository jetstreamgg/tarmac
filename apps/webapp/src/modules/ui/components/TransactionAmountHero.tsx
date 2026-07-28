import { ReactNode } from 'react';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * Wallet-screen amount hero (Figma 1036:208089): grey label, 40px token icon,
 * Heading-2 amount (Circular 44/48, -0.88 tracking) with a small USD sub-line,
 * and a right-aligned token badge pill (Badges / Illustration, 28px). Shared by
 * the flows' `transactionScreenContent` headers so every modal draws the same
 * hero above the Actions list.
 *
 * `inlineUsd` switches to the claim-modal flavour (Figma 1036:190114): a 32px
 * icon and the USD value baseline-aligned beside the amount in parentheses
 * (Body 5) instead of stacked beneath it. Same amount type and badge pill.
 */
export function TransactionAmountHero({
  label,
  amount,
  symbol,
  usd,
  inlineUsd,
  dataTestId,
  usdTestId
}: {
  label?: ReactNode;
  amount: string;
  symbol: string;
  /** Dollar value of the amount, formatted without the `$` (e.g. "10,000.00"). Omit to hide. */
  usd?: string;
  /** Render the USD inline in parentheses next to the amount, with a 32px icon. */
  inlineUsd?: boolean;
  dataTestId?: string;
  usdTestId?: string;
}) {
  const amountText = (
    <span className="font-circle text-fgPrimary truncate text-[44px] leading-12 font-medium tracking-[-0.88px]">
      {amount}
    </span>
  );

  return (
    <div className="flex flex-col gap-1" data-testid={dataTestId}>
      {label && <span className="text-fgSecondary text-sm leading-5.5">{label}</span>}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {inlineUsd ? (
            <TokenIcon token={{ symbol }} className="size-8 shrink-0" width={32} showChainIcon={false} />
          ) : (
            <TokenIcon token={{ symbol }} className="size-10 shrink-0" width={40} showChainIcon={false} />
          )}
          {inlineUsd ? (
            <div className="flex min-w-0 items-baseline gap-2">
              {amountText}
              {usd && (
                <span className="text-fgSecondary text-sm leading-5.5" data-testid={usdTestId}>
                  (${usd})
                </span>
              )}
            </div>
          ) : (
            <div className="flex min-w-0 flex-col">
              {amountText}
              {usd && (
                <span className="text-fgSecondary text-xs leading-4.5" data-testid={usdTestId}>
                  ${usd}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="bg-glassBadge flex h-7 shrink-0 items-center gap-1 rounded-full py-1.5 pr-2 pl-1.5">
          <TokenIcon token={{ symbol }} className="size-4" width={16} showChainIcon={false} />
          <span className="font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]">
            {symbol}
          </span>
        </span>
      </div>
    </div>
  );
}
