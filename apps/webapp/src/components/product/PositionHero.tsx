import { Trans } from '@lingui/react/macro';
import { splitAmount } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * The "My position" hero shared by every product position card (the
 * ProductDetailTemplate `position` slot): a token-tagged pill and the position
 * balance over a soft bottom-fade inset (Figma: 16px radius, brand-purple
 * linear fade).
 */
export function PositionHero({
  pillSymbol,
  balanceSymbol,
  amount
}: {
  /** Token tagged on the "My position" pill (the product's share/reward token). */
  pillSymbol: string;
  /** Token the balance is denominated in. */
  balanceSymbol: string;
  amount: number;
}) {
  const { whole, fraction } = splitAmount(amount);

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-[linear-gradient(180deg,_rgba(182,179,252,0)_50.24%,_rgba(117,111,236,0.1)_100%)] p-5">
      <span className="bg-surface text-textSecondary flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm">
        <TokenIcon token={{ symbol: pillSymbol }} width={16} showChainIcon={false} className="h-4 w-4" />
        <Trans>My position</Trans>
      </span>
      <span className="text-text flex items-end gap-2 font-semibold">
        <TokenIcon
          token={{ symbol: balanceSymbol }}
          width={32}
          showChainIcon={false}
          className="mb-1 h-8 w-8"
        />
        <span className="text-4xl leading-none">{whole}</span>
        {fraction && <span className="text-textSecondary text-2xl leading-tight">.{fraction}</span>}
      </span>
    </div>
  );
}
