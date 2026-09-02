import { MoveDown } from 'lucide-react';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenBadge } from '@/modules/ui/components/TransactionAmountHero';
import { FittedAmount } from './FittedAmount';

export type TokenTransferHeroSide = {
  symbol: string;
  /** Formatted display amount (modules pin two decimals per the comps). */
  amount: string;
  testId?: string;
};

/** One hero row (Figma 1310:130691): 32px icon + Heading-2 amount + token badge. */
function HeroAmountRow({ symbol, amount, testId }: TokenTransferHeroSide) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-3">
        <TokenIcon token={{ symbol }} width={32} showChainIcon={false} className="size-8 shrink-0" />
        <FittedAmount amount={amount} testId={testId} />
      </span>
      <TokenBadge symbol={symbol} />
    </div>
  );
}

/**
 * The from → to transaction hero (Figma 1310:130685 upgrade confirm /
 * 1036:205513 convert review): two amount rows joined by the 20px move-down
 * arrow. Shared by every modal that swaps one token for another.
 */
export function TokenTransferHero({
  from,
  to,
  testId
}: {
  from: TokenTransferHeroSide;
  to: TokenTransferHeroSide;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      <HeroAmountRow {...from} />
      <span aria-hidden className="pl-2">
        <MoveDown className="text-fgQuaternary size-5" />
      </span>
      <HeroAmountRow {...to} />
    </div>
  );
}
