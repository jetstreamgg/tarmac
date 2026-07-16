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

  // M6.3 mobile (486:20976): 16px inset, 40px pill→balance gap, Heading 3
  // figure (32/35) with an 18/20 fraction; desktop keeps the C3 scale.
  return (
    <div className="flex flex-col gap-10 rounded-2xl bg-[linear-gradient(180deg,_rgba(182,179,252,0)_50.24%,_rgba(117,111,236,0.1)_100%)] p-4 md:gap-6 md:p-5">
      <span className="bg-surface text-textSecondary font-circle md:font-graphik flex w-fit items-center gap-1 rounded-full py-[5px] pr-2 pl-1 text-xs leading-[14px] font-medium tracking-[-0.24px] md:gap-1.5 md:px-3 md:py-1 md:text-sm md:leading-normal md:font-normal md:tracking-normal">
        <TokenIcon
          token={{ symbol: pillSymbol }}
          width={16}
          showChainIcon={false}
          className="h-3 w-3 md:h-4 md:w-4"
        />
        <Trans>My position</Trans>
      </span>
      <span className="text-text flex items-end gap-2 font-semibold">
        <TokenIcon
          token={{ symbol: balanceSymbol }}
          width={32}
          showChainIcon={false}
          className="mb-1 h-8 w-8"
        />
        <span className="font-circle md:font-graphik text-[32px] leading-[35px] font-medium tracking-[-0.64px] md:text-4xl md:leading-none md:font-semibold md:tracking-normal">
          {whole}
        </span>
        {fraction && (
          <span className="text-textSecondary font-circle md:font-graphik text-lg leading-5 font-medium tracking-[-0.36px] md:text-2xl md:leading-tight md:font-semibold md:tracking-normal">
            .{fraction}
          </span>
        )}
      </span>
    </div>
  );
}
