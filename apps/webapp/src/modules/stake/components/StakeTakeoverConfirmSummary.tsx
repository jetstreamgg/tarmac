import { Trans } from '@lingui/react/macro';
import { formatBigInt } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { FittedAmount } from '@/components/product/FittedAmount';

function AmountBlock({ label, amount, symbol }: { label: React.ReactNode; amount: bigint; symbol: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-fgSecondary text-sm">{label}</span>
        <span className="text-text font-circle flex min-w-0 items-center gap-2 text-3xl font-medium tracking-tight">
          <TokenIcon token={{ symbol }} width={28} className="h-7 w-7 shrink-0" showChainIcon={false} />
          <FittedAmount
            amount={formatBigInt(amount)}
            maxPx={30}
            className="text-3xl leading-[1.2] tracking-tight"
          />
        </span>
      </div>
      <span className="bg-surfaceAlt text-text font-circle flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
        <TokenIcon token={{ symbol }} width={14} className="h-3.5 w-3.5" showChainIcon={false} />
        {symbol}
      </span>
    </div>
  );
}

/**
 * Open-flow review heroes (hi-fi 486:33412): stake / borrow amount heroes with
 * token chips. The step list, batch toggle and wallet states are all rendered
 * by the shared TransactionModal.
 *
 * The selected farm used to ride along here as a lone "Reward" chip. It is now
 * a `Reward` cell in `StakeConfirmGrid`, beside the delegate, the rates and
 * the transaction's Network / Network fee — so this component is the heroes
 * only, and doubles as the compact wallet-screen summary.
 */
export function StakeTakeoverConfirmSummary({
  skyToLock,
  usdsToBorrow
}: {
  skyToLock: bigint;
  usdsToBorrow: bigint;
}) {
  return (
    <div data-testid="stake-takeover-confirm-summary" className="flex flex-col gap-5">
      <AmountBlock label={<Trans>Stake amount</Trans>} amount={skyToLock} symbol="SKY" />
      {usdsToBorrow > 0n && (
        <AmountBlock label={<Trans>Borrow amount</Trans>} amount={usdsToBorrow} symbol="USDS" />
      )}
    </div>
  );
}
