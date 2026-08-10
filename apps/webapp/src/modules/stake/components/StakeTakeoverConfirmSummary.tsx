import { Trans } from '@lingui/react/macro';
import { formatBigInt } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

function AmountBlock({ label, amount, symbol }: { label: React.ReactNode; amount: bigint; symbol: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-fgSecondary text-sm">{label}</span>
        <span className="text-text font-circle flex items-center gap-2 text-3xl font-medium tracking-tight">
          <TokenIcon token={{ symbol }} width={28} className="h-7 w-7" showChainIcon={false} />
          {formatBigInt(amount)}
        </span>
      </div>
      <span className="bg-surfaceAlt text-text font-circle flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
        <TokenIcon token={{ symbol }} width={14} className="h-3.5 w-3.5" showChainIcon={false} />
        {symbol}
      </span>
    </div>
  );
}

/**
 * Confirm-modal review body (hi-fi 486:33412): stake / borrow amount heroes
 * with token chips. The step list, batch toggle, and wallet states are all
 * rendered by the shared TransactionModal. The reward row surfaces the farm
 * the flow selects on the user's behalf (there is no picker yet — AUD-19);
 * it renders only when the caller can name the reward token.
 */
export function StakeTakeoverConfirmSummary({
  skyToLock,
  usdsToBorrow,
  rewardSymbol
}: {
  skyToLock: bigint;
  usdsToBorrow: bigint;
  rewardSymbol?: string;
}) {
  return (
    <div data-testid="stake-takeover-confirm-summary" className="flex flex-col gap-5">
      <AmountBlock label={<Trans>Stake amount</Trans>} amount={skyToLock} symbol="SKY" />
      {usdsToBorrow > 0n && (
        <AmountBlock label={<Trans>Borrow amount</Trans>} amount={usdsToBorrow} symbol="USDS" />
      )}
      {rewardSymbol && (
        <div data-testid="stake-takeover-confirm-reward" className="flex items-center justify-between gap-4">
          <span className="text-fgSecondary text-sm">
            <Trans>Reward (selected automatically)</Trans>
          </span>
          <span className="bg-surfaceAlt text-text font-circle flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
            <TokenIcon
              token={{ symbol: rewardSymbol }}
              width={14}
              className="h-3.5 w-3.5"
              showChainIcon={false}
            />
            {rewardSymbol}
          </span>
        </div>
      )}
    </div>
  );
}
